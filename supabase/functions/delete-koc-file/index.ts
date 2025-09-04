// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fileId } = await req.json();
    if (!fileId) throw new Error("Thiếu fileId.");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    const { data: fileData, error: fetchError } = await supabaseAdmin.from('koc_files').select('r2_key').eq('id', fileId).single();
    if (fetchError) throw new Error(`Không tìm thấy tệp: ${fetchError.message}`);

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"), secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") },
    });
    await s3.send(new DeleteObjectCommand({ Bucket: Deno.env.get("R2_BUCKET_NAME"), Key: fileData.r2_key }));

    const { error: deleteError } = await supabaseAdmin.from('koc_files').delete().eq('id', fileId);
    if (deleteError) throw new Error(`Lỗi xóa database: ${deleteError.message}`);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});