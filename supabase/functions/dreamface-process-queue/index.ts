// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const API_BASE_URL = "https://dapi.qcv.vn";

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
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: task, error: fetchError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // No rows found
        return new Response(JSON.stringify({ message: "No pending tasks to process." }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw fetchError;
    }

    await supabaseAdmin.from('dreamface_tasks').update({ status: 'processing' }).eq('id', task.id);

    try {
      const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").eq("user_id", task.user_id).limit(1).single();
      if (apiKeyError || !apiKeyData) throw new Error("Chưa có API Key Dreamface nào được cấu hình.");
      const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

      const videoResponse = await fetch(task.original_video_url);
      if (!videoResponse.ok) throw new Error(`Failed to fetch video from URL: ${task.original_video_url}`);
      const videoBlob = await videoResponse.blob();
      const videoFileName = task.original_video_url.split('/').pop()?.split('?')[0] || 'video.mp4';
      const fetchedVideoFile = new File([videoBlob], videoFileName, { type: videoBlob.type });

      const audioResponse = await fetch(task.original_audio_url);
      if (!audioResponse.ok) throw new Error(`Failed to fetch audio from URL: ${task.original_audio_url}`);
      const audioBlob = await audioResponse.blob();
      const audioFileName = task.original_audio_url.split('/').pop()?.split('?')[0] || 'audio.mp3';
      const fetchedAudioFile = new File([audioBlob], audioFileName, { type: audioBlob.type });

      const formVideo = new FormData();
      formVideo.append("accountId", creds.accountId); formVideo.append("userId", creds.userId); formVideo.append("tokenId", creds.tokenId); formVideo.append("clientId", creds.clientId); formVideo.append("file", fetchedVideoFile, "video.mp4");
      const uploadVideoRes = await fetch(`${API_BASE_URL}/upload-video`, { method: 'POST', body: formVideo });
      const videoData = await uploadVideoRes.json();
      if (!uploadVideoRes.ok) await handleApiError(uploadVideoRes, 'upload-video');
      const uploadedVideoUrl = videoData.file_url;
      if (!uploadedVideoUrl) throw new Error("Không nhận được file_url từ upload video");

      const avatarListRes = await fetch(`${API_BASE_URL}/avatar-list?${new URLSearchParams({...creds, page_size: 20}).toString()}`);
      const avatarListData = await avatarListRes.json();
      if (!avatarListRes.ok) await handleApiError(avatarListRes, 'avatar-list');
      const avatars = avatarListData?.data?.avatars;
      if (!avatarListData.success || !Array.isArray(avatars)) throw new Error(`Không lấy được danh sách avatars. Phản hồi: ${JSON.stringify(avatarListData)}`);
      const matchedAvatar = avatars.find((a) => a.path === uploadedVideoUrl);
      if (!matchedAvatar) throw new Error("Không tìm thấy avatar trùng với video đã upload");
      const { id: avatarId, path: avatarPath } = matchedAvatar;

      const formAudio = new FormData();
      formAudio.append("accountId", creds.accountId); formAudio.append("userId", creds.userId); formAudio.append("tokenId", creds.tokenId); formAudio.append("clientId", creds.clientId); formAudio.append("avatarId", avatarId); formAudio.append("avatarPath", avatarPath); formAudio.append("file", fetchedAudioFile, fetchedAudioFile.name);
      const uploadAudioRes = await fetch(`${API_BASE_URL}/upload-voice`, { method: 'POST', body: formAudio });
      const audioData = await uploadAudioRes.json();
      if (!uploadAudioRes.ok) await handleApiError(uploadAudioRes, 'upload-voice');
      if (!audioData.success) throw new Error(`Upload audio thất bại: ${JSON.stringify(audioData)}`);
      const animateId = audioData.video_data?.animate_id || audioData.video_data?.animate_image_id;
      if (!animateId) throw new Error(`Phản hồi upload audio không chứa animate_id: ${JSON.stringify(audioData)}`);

      const updatePayload = { animate_id: animateId };
      const thumbnailUrl = audioData.video_data?.work_webp_path;
      if (thumbnailUrl) updatePayload.thumbnail_url = thumbnailUrl;
      await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', task.id);

    } catch (processingError) {
      await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: processingError.message }).eq('id', task.id);
      throw processingError;
    }

    return new Response(JSON.stringify({ success: true, message: `Processed task ${task.id}` }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error in dreamface-process-queue:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});