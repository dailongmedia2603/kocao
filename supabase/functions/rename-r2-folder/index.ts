// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { oldFolderPath, newFolderPath } = await req.json();
    if (!oldFolderPath || !newFolderPath) throw new Error("Thiếu oldFolderPath hoặc newFolderPath.");

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"), secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") }
    });
    const bucket = Deno.env.get("R2_BUCKET_NAME");

    const listCommand = new ListObjectsV2Command({ Bucket: bucket, Prefix: oldFolderPath });
    const listedObjects = await s3.send(listCommand);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      // Nếu thư mục cũ trống, chỉ cần tạo thư mục mới
      await s3.send(new CopyObjectCommand({ Bucket: bucket, Key: `${newFolderPath}/`, CopySource: '' }));
      return new Response(JSON.stringify({ success: true, message: "Thư mục trống, đã tạo thư mục mới." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sao chép các đối tượng
    await Promise.all(
      listedObjects.Contents.map(async ({ Key }) => {
        const newKey = Key.replace(oldFolderPath, newFolderPath);
        await s3.send(new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${Key}`,
          Key: newKey,
        }));
      })
    );

    // Xóa các đối tượng cũ
    const deleteParams = {
      Bucket: bucket,
      Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
    };
    await s3.send(new DeleteObjectsCommand(deleteParams));

    return new Response(JSON.stringify({ success: true, message: "Đổi tên thư mục thành công." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});