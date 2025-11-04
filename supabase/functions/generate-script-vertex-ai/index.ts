// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT } from 'https://deno.land/x/jose@v5.6.2/jwt/sign.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Re-using helper functions from check-vertex-ai-key ---
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
// --- End of re-used helper functions ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, newsContent, kocName, maxWords, model } = await req.json();
    if (!prompt || !newsContent || !kocName || !model) {
      throw new Error("Thiếu thông tin cần thiết (prompt, newsContent, kocName, model).");
    }

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

    const fullPrompt = `
      Bạn là một chuyên gia sáng tạo nội dung cho các video ngắn trên mạng xã hội.
      Dựa vào thông tin sau đây, hãy tạo một kịch bản video hấp dẫn.
      **Tên KOC (người dẫn chuyện):** ${kocName}
      **Nội dung tin tức gốc:**
      ---
      ${newsContent}
      ---
      **Yêu cầu chi tiết từ người dùng:**
      ---
      ${prompt}
      ---
      **Yêu cầu hệ thống:**
      - ${maxWords ? `Độ dài kịch bản không được vượt quá ${maxWords} từ.` : 'Giữ kịch bản ngắn gọn, súc tích.'}
      - Chỉ trả về nội dung kịch bản, không thêm bất kỳ lời giải thích hay ghi chú nào khác.
    `;

    const region = "us-central1";
    const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const vertexResponse = await fetch(vertexUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.7, topK: 1, topP: 1, maxOutputTokens: 8192 },
      }),
    });

    const vertexData = await vertexResponse.json();

    if (!vertexResponse.ok || !vertexData.candidates || vertexData.candidates.length === 0) {
      if (vertexData?.error?.message) {
        throw new Error(`Lỗi từ Vertex AI: ${vertexData.error.message}`);
      }
      throw new Error("Lỗi không xác định từ Vertex AI.");
    }

    const generatedText = vertexData.candidates[0].content.parts[0].text;
    
    return new Response(JSON.stringify({ success: true, script: generatedText, prompt: fullPrompt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});