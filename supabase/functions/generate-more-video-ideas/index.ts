// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- START: Vertex AI Helper Functions ---
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
  return await crypto.subtle.importKey("pkcs8", uint8Array, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"]);
}
function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function getGcpAccessToken(credentials: any): Promise<string> {
  const privateKey = await importPrivateKey(credentials.private_key);
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: credentials.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now };
  const encoder = new TextEncoder();
  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(encoder.encode(JSON.stringify(payload)));
  const dataToSign = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, dataToSign);
  const jwt = `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google Auth Error: ${data.error_description || "Failed to fetch access token."}`);
  return data.access_token;
}
// --- END: Vertex AI Helper Functions ---

const GPT_API_URL = "https://chatbot.qcv.vn/api/chat-vision";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { planId } = await req.json();
    if (!planId) throw new Error("Plan ID is required.");

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: plan, error: planError } = await supabaseAdmin.from('content_plans').select('*, kocs(name)').eq('id', planId).single();
    if (planError || !plan) throw new Error(`Content plan with ID ${planId} not found.`);

    const { inputs, results, kocs: koc } = plan;
    if (!inputs || !results || !koc) throw new Error("Plan data is incomplete.");

    const existingTopics = (results.video_ideas || []).map((idea: any) => `- ${idea.topic}`).join('\n');

    const prompt = `
      **VAI TRÒ:** Bạn là một chuyên gia sáng tạo nội dung TikTok.
      **BỐI CẢNH:** Dựa trên kế hoạch nội dung đã có cho KOC "${koc.name}":
      - **Chiến lược tổng thể:** ${results.overall_strategy}
      - **Các trụ cột nội dung:** ${results.content_pillars.join(', ')}
      - **Các chủ đề video đã có:**
      ${existingTopics}

      **NHIỆM VỤ:** Tạo thêm 10 ý tưởng video MỚI.

      **YÊU CẦU BẮT BUỘC:**
      1.  **KHÔNG TRÙNG LẶP:** Tuyệt đối không được lặp lại các chủ đề đã có ở trên.
      2.  **SÁNG TẠO & THỰC TẾ:** Khai thác các insight mới, các câu chuyện thực tế, hoặc các góc nhìn độc đáo chưa được đề cập.
      3.  **ĐÚNG CẤU TRÚC:** Phản hồi của bạn PHẢI là một mảng JSON hợp lệ chứa 10 đối tượng. Mỗi đối tượng phải có cấu trúc: \`{ "pillar": "tên_trụ_cột", "topic": "tiêu_đề_video", "description": "kịch_bản_chi_tiết" }\`.
      4.  **KỊCH BẢN CHI TIẾT:** Phần 'description' phải là một kịch bản hoàn chỉnh, liền mạch (150-250 từ), không phải mô tả ngắn.
      5.  **XỬ LÝ KÝ TỰ ĐẶC BIỆT:** Tất cả các ký tự dấu ngoặc kép (") bên trong các giá trị chuỗi JSON phải được thoát đúng cách bằng một dấu gạch chéo ngược (\\").
      
      **QUAN TRỌNG:** Chỉ trả về duy nhất mảng JSON. Tuyệt đối không thêm bất kỳ văn bản, giải thích, tiêu đề hay ghi chú nào khác trước hoặc sau mảng JSON.
    `;

    let newIdeas;
    let modelUsed = 'gemini-2.5-pro'; // Default model

    if (inputs.ai_model === 'gpt') {
      modelUsed = 'gpt-custom';
      const formData = new FormData();
      formData.append("prompt", prompt);
      const response = await fetch(GPT_API_URL, { method: "POST", body: formData });
      if (!response.ok) throw new Error(`GPT API Error: ${await response.text()}`);
      const data = await response.json();
      let jsonString = data.answer.trim().replace(/^```json\s*|```$/g, '').trim();
      newIdeas = JSON.parse(jsonString);
    } else { // Gemini
      const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
      if (!credentialsJson) throw new Error("Google credentials secret is not configured.");
      const credentials = JSON.parse(credentialsJson);
      const accessToken = await getGcpAccessToken(credentials);
      const region = "us-central1";
      const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${credentials.project_id}/locations/${region}/publishers/google/models/${modelUsed}:generateContent`;
      
      const vertexResponse = await fetch(vertexUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ "role": "user", "parts": [{ "text": prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.9, topP: 0.95 },
        }),
      });
      if (!vertexResponse.ok) throw new Error(`Vertex AI Error: ${await vertexResponse.text()}`);
      const vertexData = await vertexResponse.json();
      const generatedText = vertexData.candidates[0].content.parts[0].text;
      newIdeas = JSON.parse(generatedText);
    }

    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: 'generate_more',
      model_used: modelUsed,
      prompt: prompt
    };

    const updatedResults = {
      ...results,
      video_ideas: [...(results.video_ideas || []), ...newIdeas],
      logs: [...(results.logs || []), newLogEntry]
    };

    const { error: updateError } = await supabaseAdmin
      .from('content_plans')
      .update({ results: updatedResults })
      .eq('id', planId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, message: "Đã tạo thêm 10 ý tưởng mới." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-more-video-ideas:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});