// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

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
    const formData = await req.formData();
    const file = formData.get("file");
    const folderPath = formData.get("folderPath");
    const fileName = formData.get("fileName");

    if (!file || !folderPath || !fileName) {
      throw new Error("Thiếu thông tin tệp, folderPath, hoặc fileName.");
    }

    // Sửa lỗi: Đọc toàn bộ file vào một ArrayBuffer trước khi gửi
    const fileBuffer = await file.arrayBuffer();

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
        secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
      },
    });

    const bucket = Deno.env.get("R2_BUCKET_NAME");
    const key = `${folderPath}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer, // Sử dụng buffer thay vì stream
      ContentType: file.type,
    });

    await s3.send(command);

    return new Response(
      JSON.stringify({ success: true, message: `Tệp ${fileName} đã được tải lên thành công.` }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("upload-r2-video error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});