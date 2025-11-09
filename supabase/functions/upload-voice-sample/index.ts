// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Thiếu thông tin xác thực.");
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Người dùng không hợp lệ.");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("fileType") as string;

    if (!file || !fileType) {
      throw new Error("Thiếu thông tin tệp hoặc loại tệp.");
    }

    const fileName = file.name || `sample-${Date.now()}`;

    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      throw new Error("Thiếu cấu hình R2.");
    }

    const s3 = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
    
    const r2Key = `voice-clone-samples/${user.id}/${Date.now()}-${fileName}`;
    const fileBuffer = await file.arrayBuffer();

    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, Body: new Uint8Array(fileBuffer), ContentType: fileType }));
    
    const publicFileUrl = `${R2_PUBLIC_URL}/${r2Key}`;

    const { data: newSample, error: insertError } = await supabaseAdmin
      .from('voice_clone_samples')
      .insert({
        user_id: user.id,
        r2_key: r2Key,
        public_url: publicFileUrl,
        status: 'uploaded',
        file_name: fileName, // Save the filename
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Lỗi lưu thông tin file: ${insertError.message}`);
    }

    // Return both id and fileName
    return new Response(JSON.stringify({ success: true, id: newSample.id, fileName: fileName }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});