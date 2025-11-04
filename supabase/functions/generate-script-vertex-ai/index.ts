// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate, type Header } from "https://deno.land/x/djwt@v2.8/mod.ts";

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
  const header: Header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: getNumericDate(3600),
    iat: getNumericDate(0),
  };
  const jwt = await create(header, payload, privateKey);
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
    // 1. Authenticate user
    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Get request body
    const { credentialId, prompt, newsContent, kocName, maxWords, model } = await req.json();
    if (!credentialId || !prompt || !newsContent || !kocName || !model) {
      throw new Error("Thiếu thông tin cần thiết (credentialId, prompt, newsContent, kocName, model).");
    }

    // 3. Fetch credentials from DB using service role
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: credData, error: credError } = await supabaseAdmin
      .from("user_vertex_ai_credentials")
      .select("user_id, project_id, credentials_json")
      .eq("id", credentialId)
      .single();

    if (credError) throw new Error(`Không tìm thấy thông tin xác thực: ${credError.message}`);
    if (credData.user_id !== user.id) throw new Error("Forbidden: You cannot use these credentials.");

    const credentials = credData.credentials_json;
    const projectId = credData.project_id;

    // 4. Get access token
    const accessToken = await getGcpAccessToken(credentials);

    // 5. Construct prompt and call Vertex AI
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
      status: 200, // Return 200 for client-side handling
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});