// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// Import với ?no-check để tránh các vấn đề về type không cần thiết trong môi trường Deno
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.583.0?no-check";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.583.0?no-check";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;

// Cấu hình S3 Client với chỉ thị đặc biệt để không bao giờ đọc filesystem
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  // Đây là giải pháp dứt điểm: Ghi đè nhà cung cấp credentials mặc định
  credentialDefaultProvider: () => () => Promise.resolve({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
  }),
});

serve(async (req) => {
  // Xử lý yêu cầu CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { fileName, contentType, userId, projectId } = await req.json();
    if (!fileName || !contentType || !userId || !projectId) {
      throw new Error("Thiếu thông tin cần thiết.");
    }

    const storagePath = `${userId}/${projectId}/${Date.now()}-${fileName}`;
    
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storagePath,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 300 });

    const publicFileUrl = `${R2_PUBLIC_URL}/${storagePath}`;
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("user_files")
      .insert({ user_id: userId, project_id: projectId, file_name: fileName, file_url: publicFileUrl, storage_path: storagePath, source: 'upload', storage_provider: 'r2' })
      .select().single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ uploadUrl, fileRecord: dbData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong function create-r2-upload-url:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});