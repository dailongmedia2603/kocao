// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.609.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { kocId } = await req.json();
    if (!kocId) throw new Error("Thiếu kocId.");

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: filesData, error: dbError } = await supabaseClient.from('koc_files').select('*').eq('koc_id', kocId).order('created_at', { ascending: false });
    if (dbError) throw dbError;

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: { accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"), secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") }
    });

    const filesWithUrls = await Promise.all(
      filesData.map(async (file) => {
        const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: Deno.env.get("R2_BUCKET_NAME"), Key: file.r2_key }), { expiresIn: 3600 });
        return { ...file, url };
      })
    );

    return new Response(JSON.stringify({ files: filesWithUrls }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});