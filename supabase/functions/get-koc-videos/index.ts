// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
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
    const { kocId } = await req.json();
    if (!kocId) {
      throw new Error("Thiếu kocId.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Lấy các video nguồn của KOC
    const { data: files, error: dbError } = await supabaseAdmin
      .from('koc_files')
      .select('id, display_name, r2_key, thumbnail_url, created_at')
      .eq('koc_id', kocId)
      .like('r2_key', '%/sources/videos/%')
      .order('created_at', { ascending: false });

    if (dbError) {
      throw new Error(`Lỗi truy vấn CSDL: ${dbError.message}`);
    }

    // Tạo S3 client để tạo presigned URL
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
        secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
      },
    });
    const bucket = Deno.env.get("R2_BUCKET_NAME");

    // Tạo presigned URL cho mỗi video
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: bucket, Key: file.r2_key }),
          { expiresIn: 3600 } // URL có hiệu lực trong 1 giờ
        );
        return { ...file, url };
      })
    );

    return new Response(JSON.stringify({ data: filesWithUrls }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong get-koc-videos:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});