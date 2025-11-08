// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const slugify = (text: string) => {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')

  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(p, c => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-')
    .replace(/[^\w\.\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let logPayload = { user_id: null, request_url: "https://gateway.vivoo.work/v1m/voice/clone", request_payload: {}, response_body: null, status_code: null, status_text: null };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Thiếu thông tin xác thực.");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Người dùng không hợp lệ.");
    logPayload.user_id = user.id;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_voice_api_keys").select("api_key").limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error("Chưa có API Key Voice nào được cấu hình trong hệ thống.");
    const apiKey = apiKeyData.api_key;
    
    const originalFormData = await req.formData();
    const voiceName = originalFormData.get("voice_name") as string;
    const previewText = originalFormData.get("preview_text") as string;
    const originalFile = originalFormData.get("file") as File;
    const fileName = originalFormData.get("fileName") as string;
    const fileType = originalFormData.get("fileType") as string;

    if (!originalFile || !fileName || !fileType) {
      throw new Error("Thiếu thông tin tệp, tên tệp, hoặc loại tệp.");
    }
    logPayload.request_payload = { voice_name: voiceName, preview_text: previewText, original_filename: fileName };

    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) throw new Error("Thiếu cấu hình R2.");

    const s3 = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
    
    const sanitizedFileName = slugify(fileName);
    const r2Key = `voice-clone-samples/${user.id}/${Date.now()}-${sanitizedFileName}`;
    const fileBuffer = await originalFile.arrayBuffer();

    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, Body: fileBuffer, ContentType: fileType }));
    const publicFileUrl = `${R2_PUBLIC_URL}/${r2Key}`;
    logPayload.request_payload.file_url_on_r2 = publicFileUrl;

    const apiUrl = "https://gateway.vivoo.work/v1m/voice/clone";
    const apiBody = {
      voice_name: voiceName,
      preview_text: previewText,
      file_url: publicFileUrl,
      language_tag: "Vietnamese",
    };

    const response = await fetch(apiUrl, { 
      method: "POST", 
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" }, 
      body: JSON.stringify(apiBody) 
    });
    const responseData = await response.json();
    
    logPayload.status_code = response.status;
    logPayload.status_text = response.statusText;
    logPayload.response_body = responseData;

    if (!response.ok) throw new Error(responseData.message || `API clone voice báo lỗi với mã ${response.status}`);

    if (responseData.success === true) {
        const newVoiceId = responseData.clone_voice_id;
        if (!newVoiceId) throw new Error("API không trả về ID giọng nói đã clone.");

        const { error: insertError } = await supabaseAdmin
            .from('cloned_voices')
            .insert({
                voice_id: newVoiceId,
                user_id: user.id,
                voice_name: voiceName,
                sample_audio: responseData.sample_audio || null,
                cover_url: responseData.cover_url || null,
            });
        if (insertError) throw new Error(`Lỗi lưu giọng nói vào CSDL: ${insertError.message}`);
    } else {
        throw new Error(responseData.message || "API báo lỗi không thành công.");
    }

    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    logPayload.response_body = { error: err.message };
    if (!logPayload.status_code) logPayload.status_code = 500;
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    if (logPayload.user_id) {
      const { error: logError } = await supabaseAdmin.from("voice_clone_logs").insert(logPayload);
      if (logError) console.error("Lỗi ghi log clone voice:", logError);
    }
  }
});