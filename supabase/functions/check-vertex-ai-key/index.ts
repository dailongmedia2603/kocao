// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT } from 'https://deno.land/x/jose@v4.14.4/jwt/sign.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to import PEM-encoded private key
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  const binaryDer = atob(pemContents);
  const arrayBuffer = new ArrayBuffer(binaryDer.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < binaryDer.length; i++) {
    uint8Array[i] = binaryDer.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    "pkcs8",
    uint8Array,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );
}

// Helper to get Google Cloud access token using 'jose' library
async function getGcpAccessToken(credentials: any): Promise<string> {
  const privateKey = await importPrivateKey(credentials.private_key);
  
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setSubject(credentials.client_email)
    .setIssuedAt()
    .setExpirationTime('1h')
    .setClaim('scope', 'https://www.googleapis.com/auth/cloud-platform')
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Google Auth Error: ${data.error_description || "Failed to fetch access token."}`);
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get credentials from request body
    const { credentialsJson, projectId } = await req.json();
    if (!credentialsJson || !projectId) {
      throw new Error("credentialsJson and projectId are required.");
    }

    const credentials = JSON.parse(credentialsJson);

    // Get access token
    const accessToken = await getGcpAccessToken(credentials);

    // Validate token by making a test API call
    const region = "us-central1";
    const validationUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models`;
    
    const validationResponse = await fetch(validationUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!validationResponse.ok) {
      const errorData = await validationResponse.json();
      throw new Error(`Vertex AI API Error: ${errorData.error.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Kết nối thành công! Thông tin xác thực hợp lệ." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200, // Return 200 so client can handle the error message
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});