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

// --- Helper: Upload file to R2 for archival and get public URL ---
const uploadToR2AndGetUrl = async (file, type, userId) => {
  const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
  const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
  const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
  const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("Thiếu cấu hình biến môi trường cho R2.");
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const fileBuffer = await file.arrayBuffer();
  const storagePath = `dreamface/${userId}/${type}/${Date.now()}-${file.name}`;

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storagePath,
    Body: fileBuffer,
    ContentType: file.type,
  }));

  return `${R2_PUBLIC_URL}/${storagePath}`;
};

// --- Helper: Handle API Errors ---
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

// --- Helper: Fetch and update final video URL ---
const fetchAndUpdateVideoUrl = async (supabaseAdmin, creds, task) => {
  if (!task.idPost) return;

  const params = new URLSearchParams({ ...creds, id: task.idPost });
  const downloadUrl = `${API_BASE_URL}/video-download?${params.toString()}`;
  
  const downloadRes = await fetch(downloadUrl);
  const downloadData = await downloadRes.json();

  if (downloadData.code === 0 && downloadData.data.videoUrl) {
    await supabaseAdmin.from('dreamface_tasks').update({
      result_video_url: downloadData.data.videoUrl,
      status: 'completed'
    }).eq('id', task.id);
  } else if (downloadData.code !== 1) { // Ignore "processing" error code
    await supabaseAdmin.from('dreamface_tasks').update({
      status: 'failed',
      error_message: `Download failed: ${downloadData.message || 'Unknown error'}`
    }).eq('id', task.id);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_dreamface_api_keys")
      .select("account_id, user_id_dreamface, token_id, client_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (apiKeyError || !apiKeyData) {
      throw new Error("Chưa có API Key Dreamface nào được cấu hình.");
    }
    const creds = {
      accountId: apiKeyData.account_id,
      userId: apiKeyData.user_id_dreamface,
      tokenId: apiKeyData.token_id,
      clientId: apiKeyData.client_id,
    };

    const contentType = req.headers.get("content-type");
    let action, body;
    let videoFile, audioFile;

    if (contentType?.includes('multipart/form-data')) {
        const formData = await req.formData();
        action = formData.get('action');
        videoFile = formData.get('videoFile');
        audioFile = formData.get('audioFile');
        body = formData;
    } else {
        body = await req.json();
        action = body.action;
    }

    if (!action) throw new Error("Hành động (action) là bắt buộc.");

    switch (action) {
      case 'create-video': {
        if (!(body instanceof FormData) || !videoFile || !audioFile) {
          throw new Error("create-video action requires FormData with videoFile and audioFile.");
        }

        const [originalVideoUrl, originalAudioUrl] = await Promise.all([
          uploadToR2AndGetUrl(videoFile, 'video', user.id),
          uploadToR2AndGetUrl(audioFile, 'audio', user.id)
        ]);

        const { data: tempTask, error: insertError } = await supabaseAdmin
          .from('dreamface_tasks')
          .insert({
            user_id: user.id,
            title: videoFile.name,
            status: 'processing',
            original_video_url: originalVideoUrl,
            original_audio_url: originalAudioUrl
          }).select().single();
        if (insertError) throw new Error(`Lỗi tạo task tạm: ${insertError.message}`);

        try {
          const formVideo = new FormData();
          formVideo.append("accountId", creds.accountId);
          formVideo.append("userId", creds.userId);
          formVideo.append("tokenId", creds.tokenId);
          formVideo.append("clientId", creds.clientId);
          formVideo.append("file", videoFile, "video.mp4");
          const uploadVideoRes = await fetch(`${API_BASE_URL}/upload-video`, { method: 'POST', body: formVideo });
          if (!uploadVideoRes.ok) await handleApiError(uploadVideoRes, 'upload-video');
          const videoData = await uploadVideoRes.json();
          const uploadedVideoUrl = videoData.file_url;
          if (!uploadedVideoUrl) throw new Error("Không nhận được file_url từ upload video");

          const avatarListRes = await fetch(`${API_BASE_URL}/avatar-list?${new URLSearchParams({...creds, page_size: 20}).toString()}`);
          if (!avatarListRes.ok) await handleApiError(avatarListRes, 'avatar-list');
          const avatarListData = await avatarListRes.json();
          const avatars = avatarListData?.data?.avatars;
          if (!avatarListData.success || !Array.isArray(avatars)) {
            throw new Error(`Không lấy được danh sách avatars từ API Dreamface. Phản hồi: ${JSON.stringify(avatarListData)}`);
          }
          const matchedAvatar = avatars.find((a) => a.path === uploadedVideoUrl);
          if (!matchedAvatar) throw new Error("Không tìm thấy avatar trùng với video đã upload");
          const { id: avatarId, path: avatarPath } = matchedAvatar;

          const audioFileName = audioFile.name || 'audio.mp3';
          const formAudio = new FormData();
          formAudio.append("accountId", creds.accountId);
          formAudio.append("userId", creds.userId);
          formAudio.append("tokenId", creds.tokenId);
          formAudio.append("clientId", creds.clientId);
          formAudio.append("avatarId", avatarId);
          formAudio.append("avatarPath", avatarPath);
          formAudio.append("file", audioFile, audioFileName);
          const uploadAudioRes = await fetch(`${API_BASE_URL}/upload-voice`, { method: 'POST', body: formAudio });
          if (!uploadAudioRes.ok) await handleApiError(uploadAudioRes, 'upload-voice');
          const audioData = await uploadAudioRes.json();
          if (!audioData.success) throw new Error(`Upload audio thất bại: ${JSON.stringify(audioData)}`);
          const animateId = audioData.video_data?.animate_id || audioData.video_data?.animate_image_id;
          if (!animateId) throw new Error(`Phản hồi upload audio không chứa animate_id: ${JSON.stringify(audioData)}`);

          await supabaseAdmin.from('dreamface_tasks').update({ animate_id: animateId }).eq('id', tempTask.id);
          
          return new Response(JSON.stringify({ success: true, message: "Task created." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } catch (err) {
          await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: err.message }).eq('id', tempTask.id);
          throw err;
        }
      }

      case 'get-tasks': {
        const { data: processingTasks, error: processingError } = await supabaseAdmin
          .from('dreamface_tasks').select('*').eq('user_id', user.id).eq('status', 'processing');
        if (processingError) throw processingError;

        if (processingTasks.length > 0) {
          const videoListRes = await fetch(`${API_BASE_URL}/video-list?${new URLSearchParams(creds).toString()}`);
          if (!videoListRes.ok) await handleApiError(videoListRes, 'get-video-list');
          const videoListData = await videoListRes.json();
          
          const dreamfaceTasks = videoListData?.data?.list;
          if (!Array.isArray(dreamfaceTasks)) {
            console.error("Không tìm thấy danh sách video hợp lệ trong phản hồi /video-list. Phản hồi:", JSON.stringify(videoListData));
          } else {
            for (const task of processingTasks) {
              const dfTask = dreamfaceTasks.find(dft => dft.animate_id === task.animate_id);
              if (dfTask) {
                const updatePayload = {};
                if (dfTask.work_webp_path && !task.thumbnail_url) updatePayload.thumbnail_url = dfTask.work_webp_path;
                if (dfTask.id && !task.idPost) updatePayload.idPost = dfTask.id;
                if (dfTask.status === 'error' || dfTask.status === 'nsfw') {
                  updatePayload.status = 'failed';
                  updatePayload.error_message = dfTask.error_message || `External API reported status: ${dfTask.status}`;
                }
                if (Object.keys(updatePayload).length > 0) {
                  await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', task.id);
                }
                if (dfTask.id) {
                  await fetchAndUpdateVideoUrl(supabaseAdmin, creds, { ...task, ...updatePayload });
                }
              }
            }
          }
        }

        const { data: allTasks, error: allTasksError } = await supabaseAdmin
          .from('dreamface_tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (allTasksError) throw allTasksError;
        return new Response(JSON.stringify({ success: true, data: allTasks }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'get-video-url': {
        const { taskId } = body.body;
        if (!taskId) throw new Error("Task ID is required.");
        const { data: task, error: taskError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('id', taskId).single();
        if (taskError || !task) throw new Error("Task not found.");
        await fetchAndUpdateVideoUrl(supabaseAdmin, creds, task);
        const { data: updatedTask } = await supabaseAdmin.from('dreamface_tasks').select('result_video_url').eq('id', taskId).single();
        return new Response(JSON.stringify({ success: true, data: updatedTask }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'delete-task': {
        const { taskId } = body.body;
        if (!taskId) throw new Error("Task ID is required.");
        const { error } = await supabaseAdmin.from('dreamface_tasks').delete().eq('id', taskId).eq('user_id', user.id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Task deleted." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      case 'get-credit':
      case 'remain-credit': { // Handle both for flexibility
        const res = await fetch(`${API_BASE_URL}/remain-credit?${new URLSearchParams(creds).toString()}`);
        if (!res.ok) await handleApiError(res, 'get-credit');
        const creditData = await res.json();
        if (creditData.code !== 0) throw new Error(`API trả lỗi: ${creditData.message || JSON.stringify(creditData)}`);
        return new Response(JSON.stringify({ success: true, data: creditData.data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error(`Hành động không hợp lệ: ${action}`);
    }
  } catch (error) {
    console.error(`[dreamface-proxy] CRITICAL ERROR:`, error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});