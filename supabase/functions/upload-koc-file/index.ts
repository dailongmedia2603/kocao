// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const folderPath = formData.get("folderPath");
    const fileName = formData.get("fileName");
    const kocId = formData.get("kocId");
    const userId = formData.get("userId");

    if (!file || !folderPath || !fileName || !kocId || !userId) {
      throw new Error("Thiếu thông tin tệp, folderPath, fileName, kocId, hoặc userId.");
    }

    const fileBuffer = await file.arrayBuffer();
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"), secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") },
    });

    const bucket = Deno.env.get("R2_BUCKET_NAME");
    const r2Key = `${folderPath}/${Date.now()}-${fileName}`;

    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: r2Key, Body: fileBuffer, ContentType: file.type }));

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { error: dbError } = await supabaseAdmin.from('koc_files').insert({
      koc_id: kocId,
      user_id: userId,
      r2_key: r2Key,
      display_name: fileName,
    });

    if (dbError) throw new Error(`Lỗi lưu vào database: ${dbError.message}`);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});