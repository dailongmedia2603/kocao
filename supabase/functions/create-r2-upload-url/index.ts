// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;
const REGION = "us-east-1"; // R2 không quan tâm nhưng API yêu cầu
const SERVICE = "s3";

// Helper function to create HMAC signature
async function hmac(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? new TextEncoder().encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

// Helper function to convert Uint8Array to hex string
function toHex(data) {
  return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Xử lý yêu cầu CORS preflight một cách rõ ràng
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fileName, contentType, userId, projectId } = await req.json();
    if (!fileName || !contentType || !userId || !projectId) {
      throw new Error("Thiếu thông tin cần thiết.");
    }

    const storagePath = `${userId}/${projectId}/${Date.now()}-${fileName}`;
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const expires = 300; // 5 minutes

    // --- AWS Signature V4 Signing Process ---
    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${R2_ACCESS_KEY_ID}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expires.toString(),
      'X-Amz-SignedHeaders': 'host',
      'x-amz-meta-content-type': contentType,
    });
    query.sort();

    const canonicalRequest = [
      'PUT',
      `/${R2_BUCKET_NAME}/${storagePath}`,
      query.toString(),
      'host:' + host + '\n',
      'host',
      'UNSIGNED-PAYLOAD'
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest))))
    ].join('\n');

    const kDate = await hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp);
    const kRegion = await hmac(kDate, REGION);
    const kService = await hmac(kRegion, SERVICE);
    const kSigning = await hmac(kService, 'aws4_request');
    const signature = toHex(await hmac(kSigning, stringToSign));

    query.set('X-Amz-Signature', signature);
    const uploadUrl = `https://${host}/${R2_BUCKET_NAME}/${storagePath}?${query.toString()}`;
    
    // --- End Signing Process ---

    const publicFileUrl = `${R2_PUBLIC_URL}/${storagePath}`;
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("user_files")
      .insert({ user_id: userId, project_id: projectId, file_name: fileName, file_url: publicFileUrl, storage_path: storagePath, source: 'upload', storage_provider: 'r2' })
      .select().single();

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ uploadUrl, fileRecord: dbData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong function create-r2-upload-url:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});