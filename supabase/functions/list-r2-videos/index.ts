// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Max-Age": "86400"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { folderPath } = await req.json();
    if (!folderPath) {
      throw new Error("Thiếu folderPath.");
    }

    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw new Error("Thiếu cấu hình R2.");
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    });

    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `${folderPath}/`,
    });

    const listed = await s3.send(listCommand);
    // Lọc bỏ đối tượng thư mục trống (nếu có)
    const objects = (listed.Contents ?? []).filter(obj => obj.Key !== `${folderPath}/`);
    
    // Không còn lọc theo loại tệp, lấy tất cả các đối tượng
    const files = await Promise.all(
      objects.map(async (v) => {
        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: v.Key }),
          { expiresIn: 3600 }
        );
        const nameParts = v.Key.split('/');
        const displayName = nameParts[nameParts.length - 1];
        return { name: displayName, url, lastModified: v.LastModified, key: v.Key };
      })
    );

    files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    // Trả về một mảng 'files' thay vì 'videos'
    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("list-r2-files error:", err);
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});