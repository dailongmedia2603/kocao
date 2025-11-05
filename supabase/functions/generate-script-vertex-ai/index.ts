// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getGcpAccessToken } from "shared/vertex-ai-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        contents: [{ "role": "user", "parts": [{ "text": fullPrompt }] }],
        generationConfig: { temperature: 0.7, topK: 1, topP: 1, maxOutputTokens: 8192 },
      }),
    });

    if (!vertexResponse.ok) {
      const contentType = vertexResponse.headers.get("content-type");
      let errorBody;
      if (contentType && contentType.includes("application/json")) {
        const errorData = await vertexResponse.json();
        errorBody = errorData.error?.message || JSON.stringify(errorData);
      } else {
        errorBody = await vertexResponse.text();
      }
      throw new Error(`Lỗi từ Vertex AI (Status: ${vertexResponse.status}): ${errorBody}`);
    }

    const vertexData = await vertexResponse.json();

    if (!vertexData.candidates || vertexData.candidates.length === 0) {
      if (vertexData?.promptFeedback?.blockReason) {
        throw new Error(`Nội dung bị chặn vì lý do an toàn: ${vertexData.promptFeedback.blockReason}.`);
      }
      throw new Error("Lỗi từ Vertex AI: Phản hồi không chứa nội dung được tạo.");
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