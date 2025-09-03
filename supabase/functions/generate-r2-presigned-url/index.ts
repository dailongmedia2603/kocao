// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { presign } from "https://deno.land/x/aws_s3_presign@1.3.0/mod.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fileName, contentType, userId, projectId } = await req.json();

    if (!fileName || !contentType || !userId || !projectId) {
      throw new Error("Thiếu fileName, contentType, userId, hoặc projectId.");
    }

    const storagePath = `${userId}/${projectId}/${Date.now()}-${fileName}`;
    
    // Sử dụng thư viện Deno-native để tạo pre-signed URL
    const uploadUrl = presign({
      method: "PUT",
      bucket: R2_BUCKET_NAME,
      key: storagePath,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "us-east-1", // Bắt buộc, nhưng giá trị không quan trọng với R2
      expires: 300, // URL có hiệu lực trong 5 phút
      headers: {
        'Content-Type': contentType,
      },
    });

    const publicFileUrl = `${R2_PUBLIC_URL}/${storagePath}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lưu bản ghi vào DB trước khi trả về URL
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("user_files")
      .insert({
        user_id: userId,
        project_id: projectId,
        file_name: fileName,
        file_url: publicFileUrl,
        storage_path: storagePath,
        source: 'upload',
        storage_provider: 'r2',
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return new Response(JSON.stringify({ uploadUrl, fileRecord: dbData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong function generate-r2-presigned-url:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});