// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.583.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lấy thông tin R2 từ secrets của Supabase
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;

// Khởi tạo S3 client để kết nối với R2
const s3Client = new S3Client({
  region: "us-east-1", // Sử dụng một region AWS hợp lệ, R2 không quan tâm đến giá trị này
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Quan trọng đối với các dịch vụ tương thích S3 như R2
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const projectId = formData.get("projectId") as string;

    if (!file || !userId || !projectId) {
      throw new Error("Thiếu tệp, userId, hoặc projectId trong dữ liệu gửi lên.");
    }

    const fileBuffer = await file.arrayBuffer();
    const storagePath = `${userId}/${projectId}/${Date.now()}-${file.name}`;

    // Tải tệp lên R2
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storagePath,
      Body: new Uint8Array(fileBuffer),
      ContentType: file.type,
    });
    await s3Client.send(putCommand);

    // Tạo URL công khai
    const fileUrl = `${R2_PUBLIC_URL}/${storagePath}`;

    // Lưu thông tin tệp vào cơ sở dữ liệu Supabase
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("user_files")
      .insert({
        user_id: userId,
        project_id: projectId,
        file_name: file.name,
        file_url: fileUrl,
        storage_path: storagePath,
        source: 'upload',
        storage_provider: 'r2',
      })
      .select()
      .single();

    if (dbError) {
      // Cân nhắc xóa tệp khỏi R2 nếu không lưu được vào DB
      throw dbError;
    }

    return new Response(JSON.stringify(dbData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong function upload-to-r2:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});