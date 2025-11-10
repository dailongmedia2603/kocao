// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  try {
    // 1. Find a pending task
    const { data: task, error: findError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') { // No rows found
        return new Response(JSON.stringify({ message: "Queue is empty." }), { status: 200, headers: corsHeaders });
      }
      throw findError;
    }

    // 2. Lock the task
    const { data: lockedTask, error: lockError } = await supabaseAdmin
      .from('dreamface_tasks')
      .update({ status: 'processing' })
      .eq('id', task.id)
      .select()
      .single();
    
    if (lockError) throw lockError;

    try {
      // 3. Get a shared API key from the system
      const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").limit(1).single();
      if (apiKeyError || !apiKeyData) throw new Error(`Chưa có API Key Dreamface nào được cấu hình trong hệ thống.`);
      const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

      // 4. Generate pre-signed URLs for private R2 files IF NEEDED
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"), secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") },
      });
      const bucket = Deno.env.get("R2_BUCKET_NAME");
      const r2PublicUrl = Deno.env.get("R2_PUBLIC_URL");

      let finalVideoUrl = lockedTask.original_video_url;
      if (finalVideoUrl.includes(r2PublicUrl)) {
        const keyWithEncoding = finalVideoUrl.replace(`https://${r2PublicUrl}/`, '');
        const decodedKey = decodeURIComponent(keyWithEncoding);
        finalVideoUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: decodedKey }), { expiresIn: 300 });
      }

      let finalAudioUrl = lockedTask.original_audio_url;
      if (finalAudioUrl.includes(r2PublicUrl)) {
        const keyWithEncoding = finalAudioUrl.replace(`https://${r2PublicUrl}/`, '');
        const decodedKey = decodeURIComponent(keyWithEncoding);
        finalAudioUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: decodedKey }), { expiresIn: 300 });
      }

      // 5. Fetch video and audio files from their final URLs
      const [videoResponse, audioResponse] = await Promise.all([
        fetch(finalVideoUrl),
        fetch(finalAudioUrl)
      ]);
      if (!videoResponse.ok) throw new Error(`Failed to fetch video from URL: ${videoResponse.statusText}`);
      if (!audioResponse.ok) throw new Error(`Failed to fetch audio from URL: ${audioResponse.statusText}`);
      
      const videoBlob = await videoResponse.blob();
      const audioBlob = await audioResponse.blob();
      
      const videoFileName = lockedTask.original_video_url.split('/').pop()?.split('?')[0] || 'video.mp4';
      const audioFileName = lockedTask.original_audio_url.split('/').pop()?.split('?')[0] || 'audio.mp3';

      const videoFile = new File([videoBlob], videoFileName, { type: videoBlob.type });
      const audioFile = new File([audioBlob], audioFileName, { type: audioBlob.type });

      // 6. Execute the multi-step Dreamface API process
      const formVideo = new FormData();
      formVideo.append("accountId", creds.accountId); formVideo.append("userId", creds.userId); formVideo.append("tokenId", creds.tokenId); formVideo.append("clientId", creds.clientId); formVideo.append("file", videoFile, "video.mp4");
      const uploadVideoRes = await fetch(`${API_BASE_URL}/upload-video`, { method: 'POST', body: formVideo });
      const videoData = await uploadVideoRes.json();
      if (!uploadVideoRes.ok) await handleApiError(uploadVideoRes, 'upload-video');
      const uploadedVideoUrl = videoData.file_url;
      if (!uploadedVideoUrl) throw new Error("Did not receive file_url from video upload");

      const avatarListRes = await fetch(`${API_BASE_URL}/avatar-list?${new URLSearchParams({...creds, page_size: 20}).toString()}`);
      const avatarListData = await avatarListRes.json();
      if (!avatarListRes.ok) await handleApiError(avatarListRes, 'avatar-list');
      const avatars = avatarListData?.data?.avatars;
      if (!avatarListData.success || !Array.isArray(avatars)) throw new Error(`Could not get avatar list. Response: ${JSON.stringify(avatarListData)}`);
      
      const matchedAvatar = avatars.find((a) => a.path === uploadedVideoUrl);
      if (!matchedAvatar) throw new Error("Could not find the uploaded video in the avatar list");
      
      const { id: avatarId, path: avatarPath } = matchedAvatar;
      
      const formAudio = new FormData();
      formAudio.append("accountId", creds.accountId); formAudio.append("userId", creds.userId); formAudio.append("tokenId", creds.tokenId); formAudio.append("clientId", creds.clientId); formAudio.append("avatarId", avatarId); formAudio.append("avatarPath", avatarPath); formAudio.append("file", audioFile, audioFileName);
      const uploadAudioRes = await fetch(`${API_BASE_URL}/upload-voice`, { method: 'POST', body: formAudio });
      const audioData = await uploadAudioRes.json();
      if (!uploadAudioRes.ok) await handleApiError(uploadAudioRes, 'upload-voice');
      if (!audioData.success) throw new Error(`Audio upload failed: ${JSON.stringify(audioData)}`);
      
      const animateId = audioData.video_data?.animate_id || audioData.video_data?.animate_image_id;
      if (!animateId) throw new Error(`Response from audio upload did not contain animate_id: ${JSON.stringify(audioData)}`);
      
      const updatePayload = { animate_id: animateId };
      const thumbnailUrl = audioData.video_data?.work_webp_path;
      if (thumbnailUrl) updatePayload.thumbnail_url = thumbnailUrl;
      
      await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', lockedTask.id);

      return new Response(JSON.stringify({ success: true, message: `Task ${lockedTask.id} processed successfully.` }), { status: 200, headers: corsHeaders });

    } catch (processingError) {
      // If any step fails, update the task to 'failed'
      await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: processingError.message }).eq('id', lockedTask.id);
      throw processingError; // Re-throw to be caught by the outer catch block
    }
  } catch (error) {
    console.error(`[dreamface-process-queue] CRITICAL ERROR:`, error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
});