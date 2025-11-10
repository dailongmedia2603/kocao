// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { r2_key, file_id } = await req.json();
    if (!r2_key || !file_id) {
      throw new Error("Thiếu r2_key hoặc file_id.");
    }

    // --- Lấy các biến môi trường ---
    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      throw new Error("Thiếu cấu hình R2.");
    }

    // --- 1. Tạo presigned URL cho video trên R2 ---
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    const presignedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2_key }),
      { expiresIn: 300 } // URL hợp lệ trong 5 phút
    );

    // --- 2. Gọi dịch vụ Microlink để tạo thumbnail ---
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(presignedUrl)}&screenshot=true&meta=false&video=true`;
    
    const microlinkResponse = await fetch(microlinkUrl);
    if (!microlinkResponse.ok) {
        const errorText = await microlinkResponse.text();
        throw new Error(`Lỗi từ dịch vụ Microlink: ${microlinkResponse.statusText}. Details: ${errorText}`);
    }
    
    const microlinkData = await microlinkResponse.json();
    const screenshotUrl = microlinkData?.data?.screenshot?.url;

    if (!screenshotUrl) {
        throw new Error("Không thể lấy URL thumbnail từ phản hồi của Microlink.");
    }

    // --- 3. Tải ảnh thumbnail từ URL nhận được ---
    const thumbnailResponse = await fetch(screenshotUrl);
    if (!thumbnailResponse.ok) {
        throw new Error(`Không thể tải ảnh thumbnail từ URL của Microlink: ${thumbnailResponse.statusText}`);
    }
    const thumbnailBuffer = await thumbnailResponse.arrayBuffer();

    // --- 4. Tải thumbnail lên R2 ---
    const thumbnailR2Key = `${r2_key}.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: thumbnailR2Key,
      Body: new Uint8Array(thumbnailBuffer),
      ContentType: "image/jpeg",
    }));

    // --- 5. Cập nhật CSDL với URL của thumbnail ---
    const publicThumbnailUrl = `${R2_PUBLIC_URL}/${thumbnailR2Key}`;
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: updateError } = await supabaseAdmin
      .from("koc_files")
      .update({ thumbnail_url: publicThumbnailUrl })
      .eq("id", file_id);

    if (updateError) {
      throw new Error(`Lỗi cập nhật CSDL: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, thumbnailUrl: publicThumbnailUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong generate-thumbnail:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});