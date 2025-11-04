// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SignJWT } from 'https://deno.land/x/jose@v4.14.4/jwt/sign.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function getGcpAccessToken(credentials: any): Promise<string> {
  const privateKey = await importPrivateKey(credentials.private_key);
  const jwt = await new SignJWT({ 'scope': 'https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setSubject(credentials.client_email)
    .setIssuedAt()
    .setExpirationTime('1h')
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
    const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
    if (!credentialsJson) {
      throw new Error("Secret GOOGLE_CREDENTIALS_JSON chưa được cấu hình trong Supabase Vault.");
    }

    const credentials = JSON.parse(credentialsJson);
    const projectId = credentials.project_id;
    if (!projectId) {
      throw new Error("Tệp JSON trong secret không chứa 'project_id'.");
    }

    const accessToken = await getGcpAccessToken(credentials);
    const region = "us-central1";
    const validationUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models`;
    
    const validationResponse = await fetch(validationUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!validationResponse.ok) {
      const errorData = await validationResponse.json();
      throw new Error(`Vertex AI API Error: ${errorData.error.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Kết nối thành công tới dự án: ${projectId}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});