// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "https://dapi.qcv.vn";

const uploadToR2AndGetUrl = async (file, type, userId) => {
  const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
  const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
  const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
  const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) throw new Error("Thiếu cấu hình biến môi trường cho R2.");
  const s3 = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
  const fileBuffer = await file.arrayBuffer();
  const storagePath = `dreamface/${userId}/${type}/${Date.now()}-${file.name}`;
  await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storagePath, Body: fileBuffer, ContentType: file.type }));
  return `${R2_PUBLIC_URL}/${storagePath}`;
};

const handleApiError = async (response, context) => {
  const errorText = await response.text();
  let errorMessage = `Dreamface API Error (${context}): Status ${response.status}.`;
  try {
    const errorJson = JSON.parse(errorText);
    errorMessage += ` Message: ${errorJson.msg || errorJson.message || 'Unknown error'}`;
  } catch (e) {
    errorMessage += ` Response: ${errorText.slice(0, 500)}`;
  }
  throw new Error(errorMessage);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  const logPayload = { user_id: null, dreamface_task_id: null, action: 'unknown', request_payload: null, response_body: null, status_code: 200, error_message: null };
  let responseData = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");
    logPayload.user_id = user.id;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").eq("user_id", user.id).limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error("Chưa có API Key Dreamface nào được cấu hình.");
    const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

    const contentType = req.headers.get("content-type");
    let action, body, videoFile, audioFile;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await req.formData();
      action = formData.get('action');
      videoFile = formData.get('videoFile');
      audioFile = formData.get('audioFile');
      const formBody = {};
      for (const [key, value] of formData.entries()) {
        formBody[key] = typeof value === 'string' ? value : `[File: ${value.name}, Size: ${value.size}]`;
      }
      logPayload.request_payload = formBody;
      body = formData;
    } else {
      body = await req.json();
      action = body.action;
      logPayload.request_payload = body;
    }
    logPayload.action = action;
    if (!action) throw new Error("Hành động (action) là bắt buộc.");

    switch (action) {
      case 'create-video': {
        if (!(body instanceof FormData) || !videoFile || !audioFile) throw new Error("create-video action requires FormData with videoFile and audioFile.");
        const [originalVideoUrl, originalAudioUrl] = await Promise.all([uploadToR2AndGetUrl(videoFile, 'video', user.id), uploadToR2AndGetUrl(audioFile, 'audio', user.id)]);
        const { data: tempTask, error: insertError } = await supabaseAdmin.from('dreamface_tasks').insert({ user_id: user.id, title: videoFile.name, status: 'processing', original_video_url: originalVideoUrl, original_audio_url: originalAudioUrl }).select().single();
        if (insertError) throw new Error(`Lỗi tạo task tạm: ${insertError.message}`);
        logPayload.dreamface_task_id = tempTask.id;
        try {
          const formVideo = new FormData();
          formVideo.append("accountId", creds.accountId); formVideo.append("userId", creds.userId); formVideo.append("tokenId", creds.tokenId); formVideo.append("clientId", creds.clientId); formVideo.append("file", videoFile, "video.mp4");
          const uploadVideoRes = await fetch(`${API_BASE_URL}/upload-video`, { method: 'POST', body: formVideo });
          const videoData = await uploadVideoRes.json();
          if (!uploadVideoRes.ok) { logPayload.response_body = videoData; await handleApiError(uploadVideoRes, 'upload-video'); }
          const uploadedVideoUrl = videoData.file_url;
          if (!uploadedVideoUrl) throw new Error("Không nhận được file_url từ upload video");
          const avatarListRes = await fetch(`${API_BASE_URL}/avatar-list?${new URLSearchParams({...creds, page_size: 20}).toString()}`);
          const avatarListData = await avatarListRes.json();
          if (!avatarListRes.ok) { logPayload.response_body = avatarListData; await handleApiError(avatarListRes, 'avatar-list'); }
          const avatars = avatarListData?.data?.avatars;
          if (!avatarListData.success || !Array.isArray(avatars)) throw new Error(`Không lấy được danh sách avatars. Phản hồi: ${JSON.stringify(avatarListData)}`);
          const matchedAvatar = avatars.find((a) => a.path === uploadedVideoUrl);
          if (!matchedAvatar) throw new Error("Không tìm thấy avatar trùng với video đã upload");
          const { id: avatarId, path: avatarPath } = matchedAvatar;
          const audioFileName = audioFile.name || 'audio.mp3';
          const formAudio = new FormData();
          formAudio.append("accountId", creds.accountId); formAudio.append("userId", creds.userId); formAudio.append("tokenId", creds.tokenId); formAudio.append("clientId", creds.clientId); formAudio.append("avatarId", avatarId); formAudio.append("avatarPath", avatarPath); formAudio.append("file", audioFile, audioFileName);
          const uploadAudioRes = await fetch(`${API_BASE_URL}/upload-voice`, { method: 'POST', body: formAudio });
          const audioData = await uploadAudioRes.json();
          logPayload.response_body = audioData;
          if (!uploadAudioRes.ok) await handleApiError(uploadAudioRes, 'upload-voice');
          if (!audioData.success) throw new Error(`Upload audio thất bại: ${JSON.stringify(audioData)}`);
          const animateId = audioData.video_data?.animate_id || audioData.video_data?.animate_image_id;
          if (!animateId) throw new Error(`Phản hồi upload audio không chứa animate_id: ${JSON.stringify(audioData)}`);
          const updatePayload = { animate_id: animateId };
          const thumbnailUrl = audioData.video_data?.work_webp_path;
          if (thumbnailUrl) updatePayload.thumbnail_url = thumbnailUrl;
          await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', tempTask.id);
          responseData = { success: true, message: "Task created." };
        } catch (err) {
          await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: err.message }).eq('id', tempTask.id);
          throw err;
        }
        break;
      }
      case 'delete-task': {
        const { taskId } = body.body;
        if (!taskId) throw new Error("Task ID is required.");
        logPayload.dreamface_task_id = taskId;
        const { error } = await supabaseAdmin.from('dreamface_tasks').delete().eq('id', taskId).eq('user_id', user.id);
        if (error) throw error;
        responseData = { success: true, message: "Task deleted." };
        break;
      }
      default: throw new Error(`Hành động không hợp lệ: ${action}`);
    }
    logPayload.response_body = logPayload.response_body || responseData;
    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error(`[dreamface-proxy] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert(logPayload);
  }
});