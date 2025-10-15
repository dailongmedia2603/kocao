// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Helper: Upload file to R2 and get public URL ---
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

// --- Helper: Fetch and update final video URL ---
const fetchAndUpdateVideoUrl = async (supabaseAdmin, task, apiKeyData) => {
  if (!task.idPost) return;

  const params = new URLSearchParams({
    accountId: apiKeyData.account_id,
    userId: apiKeyData.user_id_dreamface,
    tokenId: apiKeyData.token_id,
    clientId: apiKeyData.client_id,
    id: task.idPost,
  });
  const downloadUrl = `https://dapi.qcv.vn/video-download?${params.toString()}`;
  
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

    const contentType = req.headers.get("content-type");
    let action, body, taskId, animateId;
    let videoFile, audioFile;

    if (contentType && contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        action = formData.get('action') as string;
        videoFile = formData.get('videoFile') as File;
        audioFile = formData.get('audioFile') as File;
    } else {
        ({ action, body } = await req.json());
        taskId = body?.taskId;
        animateId = body?.animateId;
    }

    switch (action) {
      case 'create-video': {
        if (!videoFile || !audioFile) throw new Error("Video and audio files are required.");

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
        if (insertError) throw insertError;

        // --- Chain of Dreamface API calls ---
        // 1. Upload video to get file_url
        const uploadVideoParams = new URLSearchParams({ accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id, url: originalVideoUrl });
        const uploadVideoRes = await fetch(`https://dapi.qcv.vn/upload-video?${uploadVideoParams.toString()}`);
        const uploadVideoData = await uploadVideoRes.json();
        if (uploadVideoData.code !== 0) throw new Error(`Upload video failed: ${uploadVideoData.message}`);
        const dreamfaceVideoUrl = uploadVideoData.data.file_url;

        // 2. Get avatarId from avatar-list
        const avatarListParams = new URLSearchParams({ accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id, page: '1', limit: '20' });
        const avatarListRes = await fetch(`https://dapi.qcv.vn/avatar-list?${avatarListParams.toString()}`);
        const avatarListData = await avatarListRes.json();
        const avatar = avatarListData.data.list.find(a => a.path === dreamfaceVideoUrl);
        if (!avatar) throw new Error("Could not find matching avatarId after video upload.");
        const avatarId = avatar._id;

        // 3. Upload audio to get animate_id (UPDATED TO POST with urlencoded)
        const uploadVoiceBody = new URLSearchParams({
          accountId: apiKeyData.account_id,
          userId: apiKeyData.user_id_dreamface,
          tokenId: apiKeyData.token_id,
          clientId: apiKeyData.client_id,
          url: originalAudioUrl,
          avatarId: avatarId,
          avatarPath: dreamfaceVideoUrl
        });

        const uploadVoiceRes = await fetch('https://dapi.qcv.vn/upload-voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: uploadVoiceBody.toString(),
        });
        
        const uploadVoiceData = await uploadVoiceRes.json();
        if (uploadVoiceData.code !== 0) throw new Error(`Upload voice failed: ${uploadVoiceData.message}`);
        const newAnimateId = uploadVoiceData.data.animate_id;

        // 4. Update task with animate_id
        await supabaseAdmin.from('dreamface_tasks').update({ animate_id: newAnimateId }).eq('id', tempTask.id);

        return new Response(JSON.stringify({ success: true, message: "Task created." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'get-tasks': {
        const { data: processingTasks, error: processingError } = await supabaseAdmin
          .from('dreamface_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'processing');
        if (processingError) throw processingError;

        if (processingTasks.length > 0) {
          const videoListParams = new URLSearchParams({ accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id, page: '1', limit: '20' });
          const videoListRes = await fetch(`https://dapi.qcv.vn/video-list?${videoListParams.toString()}`);
          const videoListData = await videoListRes.json();
          const dreamfaceTasks = videoListData.data.list;

          for (const task of processingTasks) {
            const dfTask = dreamfaceTasks.find(dft => dft.animate_id === task.animate_id);
            if (dfTask) {
              const updatePayload = {};
              if (dfTask.work_webp_path && !task.thumbnail_url) updatePayload.thumbnail_url = dfTask.work_webp_path;
              if (dfTask.id && !task.idPost) updatePayload.idPost = dfTask.id;
              
              if (dfTask.status === 'error' || dfTask.status === 'nsfw') {
                updatePayload.status = 'failed';
                updatePayload.error_message = dfTask.error_message || 'Video marked as error/nsfw by provider.';
              }
              
              if (Object.keys(updatePayload).length > 0) {
                await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', task.id);
              }

              if (dfTask.id) {
                await fetchAndUpdateVideoUrl(supabaseAdmin, { ...task, ...updatePayload }, apiKeyData);
              }
            }
          }
        }

        const { data: allTasks, error: allTasksError } = await supabaseAdmin
          .from('dreamface_tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (allTasksError) throw allTasksError;

        return new Response(JSON.stringify({ success: true, data: allTasks }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'get-video-url': {
        if (!taskId) throw new Error("Task ID is required.");
        const { data: task, error: taskError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('id', taskId).single();
        if (taskError || !task) throw new Error("Task not found.");

        await fetchAndUpdateVideoUrl(supabaseAdmin, task, apiKeyData);
        
        const { data: updatedTask } = await supabaseAdmin.from('dreamface_tasks').select('result_video_url').eq('id', taskId).single();
        return new Response(JSON.stringify({ success: true, data: updatedTask }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case 'delete-task': {
        if (!taskId) throw new Error("Task ID is required.");
        const { error } = await supabaseAdmin.from('dreamface_tasks').delete().eq('id', taskId).eq('user_id', user.id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Task deleted." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error("Invalid action specified.");
    }
  } catch (err) {
    console.error("--- Error in Dreamface Proxy Function ---", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});