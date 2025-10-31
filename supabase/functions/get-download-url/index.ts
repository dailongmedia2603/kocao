// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { r2_key, display_name } = await req.json();
    if (!r2_key || !display_name) {
      throw new Error("r2_key and display_name are required.");
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
        secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
      },
    });

    const command = new GetObjectCommand({
      Bucket: Deno.env.get("R2_BUCKET_NAME"),
      Key: r2_key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(display_name)}"`
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    return new Response(JSON.stringify({ downloadUrl: presignedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-download-url function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});