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

    const contentType = req.headers.get("content-type");
    let action, body;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await req.formData();
      action = formData.get('action');
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
        if (!(body instanceof FormData)) throw new Error("create-video action requires FormData.");
        const videoUrl = body.get('videoUrl');
        const audioFile = body.get('audioFile');
        const kocId = body.get('kocId');
        if (!videoUrl || !audioFile || !kocId) throw new Error("create-video action requires videoUrl, audioFile, and kocId.");

        const originalAudioUrl = await uploadToR2AndGetUrl(audioFile, 'audio', user.id);
        const videoFileName = videoUrl.split('/').pop()?.split('?')[0] || 'video.mp4';

        const { data: newTask, error: insertError } = await supabaseAdmin.from('dreamface_tasks').insert({ 
            user_id: user.id, 
            title: videoFileName, 
            status: 'pending',
            original_video_url: videoUrl, 
            original_audio_url: originalAudioUrl, 
            koc_id: kocId 
        }).select().single();

        if (insertError) throw new Error(`Lỗi tạo task: ${insertError.message}`);
        
        logPayload.dreamface_task_id = newTask.id;
        responseData = { success: true, message: "Task queued successfully." };
        break;
      }
      case 'create-video-from-url': {
        const { videoUrl, audioUrl, kocId } = body;
        if (!videoUrl || !audioUrl || !kocId) throw new Error("create-video-from-url action requires videoUrl, audioUrl, and kocId.");

        const videoFileName = videoUrl.split('/').pop()?.split('?')[0] || 'video.mp4';

        const { data: newTask, error: insertError } = await supabaseAdmin.from('dreamface_tasks').insert({
            user_id: user.id,
            title: videoFileName,
            status: 'pending',
            original_video_url: videoUrl,
            original_audio_url: audioUrl,
            koc_id: kocId
        }).select().single();

        if (insertError) throw new Error(`Lỗi tạo task: ${insertError.message}`);

        logPayload.dreamface_task_id = newTask.id;
        responseData = { success: true, message: "Task queued successfully from URL." };
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