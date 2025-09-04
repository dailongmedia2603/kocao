// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { folderPath } = await req.json();
    if (!folderPath) {
      throw new Error("Thiếu folderPath.");
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"), secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") }
    });
    const bucket = Deno.env.get("R2_BUCKET_NAME");

    const listCommand = new ListObjectsV2Command({ Bucket: bucket, Prefix: folderPath });
    const listedObjects = await s3.send(listCommand);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Thư mục trống hoặc không tồn tại." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const deleteParams = {
      Bucket: bucket,
      Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
    };
    await s3.send(new DeleteObjectsCommand(deleteParams));

    return new Response(JSON.stringify({ success: true, message: "Xóa thư mục thành công." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});