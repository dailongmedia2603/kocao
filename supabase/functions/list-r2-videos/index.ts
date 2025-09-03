// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.501.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.501.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw new Error("Thiếu cấu hình Cloudflare R2.");
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    // 1. Lấy danh sách tất cả các đối tượng trong bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
    });
    const listOutput = await s3.send(listCommand);
    const objects = listOutput.Contents || [];

    // Lọc các tệp video
    const videoFiles = objects.filter(obj => 
        obj.Key && (obj.Key.endsWith('.mp4') || obj.Key.endsWith('.mov') || obj.Key.endsWith('.webm'))
    );

    // 2. Tạo presigned URL cho mỗi video
    const videosWithUrls = await Promise.all(
      videoFiles.map(async (video) => {
        const getCommand = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: video.Key,
        });
        const url = await getSignedUrl(s3, getCommand, { expiresIn: 3600 }); // URL có hiệu lực trong 1 giờ
        return {
          name: video.Key,
          url: url,
          lastModified: video.LastModified,
        };
      })
    );
    
    // Sắp xếp theo ngày sửa đổi, mới nhất lên đầu
    videosWithUrls.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return new Response(JSON.stringify({ videos: videosWithUrls }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong Edge Function list-r2-videos:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});