// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");
    logPayload.user_id = user.id;

    const contentType = req.headers.get("content-type");
    let videoUrl, audioUrl, kocId, action;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await req.formData();
      action = formData.get('action');
      videoUrl = formData.get('videoUrl');
      const audioFile = formData.get('audioFile');
      kocId = formData.get('kocId');
      if (!videoUrl || !audioFile || !kocId) throw new Error("create-video action requires videoUrl, audioFile, and kocId.");
      audioUrl = await uploadToR2AndGetUrl(audioFile, 'audio', user.id);
      logPayload.request_payload = { action, videoUrl, kocId, fileName: audioFile.name };
    } else {
      const body = await req.json();
      action = body.action;
      videoUrl = body.videoUrl;
      audioUrl = body.audioUrl;
      kocId = body.kocId;
      if (!videoUrl || !audioUrl || !kocId) throw new Error("create-video-from-url action requires videoUrl, audioUrl, and kocId.");
      logPayload.request_payload = body;
    }
    logPayload.action = action;

    // Centralized credit check and task creation
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('check_and_deduct_credit', {
      p_user_id: user.id,
      p_koc_id: kocId,
      p_idea_id: null, // Explicitly pass null for idea_id
      p_video_url: videoUrl,
      p_audio_url: audioUrl,
    });

    if (rpcError) throw new Error(`Lỗi RPC: ${rpcError.message}`);
    
    const result = rpcData[0];
    if (!result.success) throw new Error(result.message);

    logPayload.dreamface_task_id = result.new_task_id;
    logPayload.response_body = result;

    return new Response(JSON.stringify({ success: true, message: result.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[dreamface-proxy] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert(logPayload);
  }
});