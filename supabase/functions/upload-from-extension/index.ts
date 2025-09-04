// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Get Environment Variables ---
    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      throw new Error("Thiếu cấu hình biến môi trường cho R2.");
    }

    // --- Parse Form Data ---
    const formData = await req.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");
    const projectId = formData.get("projectId");
    const fileName = formData.get("fileName");

    if (!file || !userId || !projectId || !fileName) {
      throw new Error("Thiếu thông tin tệp, userId, projectId, hoặc fileName.");
    }

    // --- 1. Upload file to R2 ---
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    const fileBuffer = await file.arrayBuffer();
    const storagePath = `${userId}/${projectId}/${Date.now()}-${fileName}`;

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storagePath,
      Body: fileBuffer,
      ContentType: file.type,
    }));

    // --- 2. Construct the public URL ---
    const publicUrl = `${R2_PUBLIC_URL}/${storagePath}`;

    // --- 3. Save file metadata to Supabase database ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: dbError } = await supabaseAdmin.from("user_files").insert({
      user_id: userId,
      project_id: projectId,
      file_name: fileName,
      file_url: publicUrl,
      storage_path: storagePath,
      source: 'download', // Mark this file as downloaded from the web
      storage_provider: 'r2' // Specify R2 as the provider
    });

    if (dbError) {
      console.error("Lỗi lưu vào DB:", dbError);
      // Optional: Add cleanup logic here to delete the file from R2 if DB insert fails
      throw dbError;
    }

    return new Response(JSON.stringify({ success: true, message: `Tệp ${fileName} đã được tải lên R2.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lỗi trong Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});