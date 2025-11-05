// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- START: Vertex AI Helper Functions (copied for self-containment) ---
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

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGcpAccessToken(credentials: any): Promise<string> {
  const privateKey = await importPrivateKey(credentials.private_key);
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const encoder = new TextEncoder();
  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(encoder.encode(JSON.stringify(payload)));
  const dataToSign = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, dataToSign);
  const jwt = `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google Auth Error: ${data.error_description || "Failed to fetch access token."}`);
  return data.access_token;
}
// --- END: Vertex AI Helper Functions ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inputs, kocName } = await req.json();
    if (!inputs || !kocName) throw new Error("Missing 'inputs' or 'kocName' in request body.");

    const fullPrompt = `
# Instruction for AI
Bạn là một chuyên gia chiến lược phát triển kênh TikTok và nhà sáng tạo nội dung hàng đầu. Nhiệm vụ của bạn là phân tích các thông tin được cung cấp để xây dựng một kế hoạch nội dung toàn diện và chi tiết.

# Core Principles for Analysis (Your internal thinking process)
1.  **Understand Deeply:** Analyze the target audience's pain points, desires, and TikTok behavior.
2.  **Core Value:** Ensure every content idea provides specific value (education, entertainment, inspiration).
3.  **Strong Hooks:** Prioritize powerful 1-3 second hooks suitable for a monologue format.
4.  **Virality & Engagement:** Propose topics with high potential for discussion and sharing.
5.  **Brand Consistency:** Ensure content pillars build a clear, unique personal brand.
6.  **Monologue Style:** All suggestions must fit a one-person-talking-to-camera format, emphasizing authenticity and storytelling.

# User Input Fields
-   **KOC Name:** ${kocName}
-   **Topic:** ${inputs.topic}
-   **Target Audience:** ${inputs.target_audience}
-   **KOC Persona:** ${inputs.koc_persona}
-   **Main Goal:** ${inputs.goals || 'Not provided'}
-   **Strengths/Uniqueness:** ${inputs.strengths || 'Not provided'}
-   **Competitors/Inspiration:** ${inputs.competitors || 'Not provided'}

# Output Format
Dựa trên phân tích của bạn, hãy trình bày kế hoạch một cách chi tiết, chuyên nghiệp và dễ hiểu. Chỉ bao gồm các phần sau:

**PHẦN 1: PHÂN TÍCH VÀ CHIẾN LƯỢC CỐT LÕI**
-   **Phân tích Đối tượng Mục tiêu:** Đi sâu vào insight, vấn đề và mong muốn của họ.
-   **Định vị Thương hiệu Cá nhân:** Xác định phong cách và giá trị cốt lõi mà KOC sẽ mang lại.
-   **Chiến lược Tăng trưởng Gợi ý:** Đề xuất ngắn gọn 2-3 chiến thuật để phát triển kênh.

**PHẦN 2: CÁC TUYẾN NỘI DUNG CHÍNH (CONTENT PILLARS)**
-   Đề xuất 3-5 tuyến nội dung lớn, độc đáo, phù hợp với định vị thương hiệu.
-   Trình bày dưới dạng danh sách gạch đầu dòng, mỗi tuyến nội dung có mô tả chi tiết về mục đích và dạng thể hiện.

**PHẦN 3: ĐỀ XUẤT CHỦ ĐỀ VIDEO CỤ THỂ**
-   Cho MỖI tuyến nội dung, đề xuất 5-7 chủ đề video chi tiết.
-   Mỗi chủ đề video phải bao gồm:
    *   **Tên Chủ đề Video:** Gợi hình, hấp dẫn.
    *   **Mô tả Ngắn gọn:** Nội dung chính sẽ chia sẻ.
    *   **Hook Gợi ý:** Một câu mở đầu thu hút.
    *   **Key Takeaways/Giá trị:** Người xem nhận được gì.
    *   **Call to Action (CTA) Gợi ý:** Một lời kêu gọi hành động.

**QUAN TRỌNG:** Chỉ trả về kết quả theo đúng định dạng trên. Không thêm bất kỳ lời giải thích, giới thiệu hay kết luận nào khác.
`;

    const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
    if (!credentialsJson) throw new Error("Secret GOOGLE_CREDENTIALS_JSON is not configured in Supabase Vault.");
    const credentials = JSON.parse(credentialsJson);
    const projectId = credentials.project_id;
    if (!projectId) throw new Error("The credentials JSON in the secret does not contain a 'project_id'.");
    const accessToken = await getGcpAccessToken(credentials);

    const region = "us-central1";
    const model = "gemini-2.5-pro";
    const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const vertexResponse = await fetch(vertexUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ "role": "user", "parts": [{ "text": fullPrompt }] }],
        generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 8192 },
      }),
    });

    if (!vertexResponse.ok) {
      const errorBody = await vertexResponse.text();
      throw new Error(`Vertex AI API Error (Status: ${vertexResponse.status}): ${errorBody}`);
    }

    const vertexData = await vertexResponse.json();
    if (!vertexData.candidates || vertexData.candidates.length === 0) {
      if (vertexData?.promptFeedback?.blockReason) throw new Error(`Content blocked by safety settings: ${vertexData.promptFeedback.blockReason}.`);
      throw new Error("Vertex AI returned an empty response.");
    }

    const generatedText = vertexData.candidates[0].content.parts[0].text;
    
    return new Response(JSON.stringify({ success: true, results: { generatedPlan: generatedText, fullPrompt: fullPrompt } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-content-plan function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});