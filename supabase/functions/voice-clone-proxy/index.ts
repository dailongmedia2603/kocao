// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { lookup as mimeLookup } from "npm:mime-types@^2.1.35";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
  return cleaned.length ? cleaned : `file_${Date.now()}`;
}

function ensureExt(name: string, type?: string) {
  const hasDot = /\.[a-z0-9]+$/i.test(name);
  if (hasDot) return name;

  let ext = "";
  if (type && typeof type === "string") {
    const sub = type.split("/")[1];
    if (sub) ext = `.${sub.replace(/[^\w]+/g, "")}`;
  }
  return `${name}${ext || ""}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let logPayload = {
    user_id: null,
    request_url: "https://gateway.vivoo.work/v1m/voice/clone",
    request_payload: {},
    response_body: null,
    status_code: null,
    status_text: null
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Thiếu thông tin xác thực.");
    const { data: { user } } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) throw new Error("Người dùng không hợp lệ.");
    logPayload.user_id = user.id;

    const { data: apiKeyData, error: apiKeyError } =
      await supabaseAdmin.from("user_voice_api_keys")
        .select("api_key").limit(1).single();
    if (apiKeyError || !apiKeyData)
      throw new Error("Chưa có API Key Voice nào được cấu hình trong hệ thống.");
    const apiKey = apiKeyData.api_key;

    const form = await req.formData();
    const voiceName = (form.get("voice_name") as string) || "";
    const previewText = (form.get("preview_text") as string) || "";
    const originalFile = form.get("file") as File | null;
    let fileName = (form.get("fileName") as string) || "";
    let fileType = (form.get("fileType") as string) || "";

    if (!originalFile) {
      throw new Error("Thiếu tệp âm thanh tải lên.");
    }
    
    if (!fileType || typeof fileType !== "string") {
      if (originalFile && typeof originalFile.type === "string" && originalFile.type) {
        fileType = originalFile.type;
      }
    }
    
    if (!fileType) {
      const guessed = mimeLookup(fileName || "") || "application/octet-stream";
      fileType = String(guessed);
    }

    fileName = ensureExt(sanitizeFileName(fileName || (originalFile as any).name || "sample"), fileType);

    const maxBytes = 25 * 1024 * 1024;
    if (typeof originalFile.size === "number") {
      if (originalFile.size <= 0) throw new Error("Tệp rỗng, vui lòng chọn lại.");
      if (originalFile.size > maxBytes) throw new Error("Tệp quá lớn (giới hạn 25MB).");
    }

    logPayload.request_payload = {
      voice_name: voiceName,
      preview_text: previewText,
      original_filename: fileName,
      declared_type: fileType
    };

    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    let R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL)
      throw new Error("Thiếu cấu hình R2.");

    if (R2_PUBLIC_URL.endsWith("/")) R2_PUBLIC_URL = R2_PUBLIC_URL.slice(0, -1);

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });

    const r2Key = `voice-clone-samples/${user.id}/${Date.now()}-${fileName}`;
    const fileBuf = new Uint8Array(await originalFile.arrayBuffer());

    try {
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: fileBuf,
        ContentType: fileType || "application/octet-stream",
      }));
    } catch (r2Error) {
      throw new Error(`Lỗi tải file lên R2: ${r2Error?.message || String(r2Error)}`);
    }

    const publicFileUrl = `${R2_PUBLIC_URL}/${encodeURI(r2Key)}`;
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
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(apiBody)
    });

    const responseData = await response.json().catch(() => ({}));
    logPayload.status_code = response.status;
    logPayload.status_text = response.statusText;
    logPayload.response_body = responseData;

    if (!response.ok || responseData?.success !== true) {
      throw new Error(responseData?.message || `API clone voice báo lỗi (HTTP ${response.status}).`);
    }

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

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    logPayload.response_body = { error: err?.message || String(err) };
    const isClientErr = /thiếu|tệp|quá lớn|xác thực|không hợp lệ/i.test(String(err?.message || ""));
    const httpStatus = isClientErr ? 400 : 500;
    if (!logPayload.status_code) logPayload.status_code = httpStatus;

    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } finally {
    if (logPayload.user_id) {
      const { error: logError } = await supabaseAdmin.from("voice_clone_logs").insert(logPayload);
      if (logError) console.error("Lỗi ghi log clone voice:", logError);
    }
  }
});