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
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    const createFolder = async (path: string) => {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `${path}/`,
        Body: "",
        ContentLength: 0,
      });
      await s3.send(command);
    };

    // Create main folder and subfolders in parallel
    await Promise.all([
      createFolder(folderPath),
      createFolder(`${folderPath}/generated`),
      createFolder(`${folderPath}/sources`),
      createFolder(`${folderPath}/sources/videos`),
      createFolder(`${folderPath}/sources/audios`),
    ]);

    return new Response(JSON.stringify({ success: true, message: `Thư mục ${folderPath} và các thư mục con đã được tạo.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-r2-folder error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});