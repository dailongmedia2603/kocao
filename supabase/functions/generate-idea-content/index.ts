// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- START: Inlined Vertex AI Helper Functions ---
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
// --- END: Inlined Vertex AI Helper Functions ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ideaId } = await req.json().catch(() => ({}));
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let ideasToProcess;
    let fetchError;

    if (ideaId) {
      const { data, error } = await supabaseAdmin
        .from('koc_content_ideas')
        .select('id, user_id, idea_content, koc_id, status')
        .eq('id', ideaId)
        .limit(1);
      ideasToProcess = data;
      fetchError = error;
    } else {
      const { data, error } = await supabaseAdmin
        .from('koc_content_ideas')
        .select('id, user_id, idea_content, koc_id, status')
        .in('status', ['Chưa sử dụng', 'Lỗi tạo content'])
        .limit(5);
      ideasToProcess = data;
      fetchError = error;
    }

    if (fetchError) {
      throw new Error(`Error fetching ideas: ${fetchError.message}`);
    }

    if (!ideasToProcess || ideasToProcess.length === 0) {
      const message = ideaId ? `Idea with ID ${ideaId} not found or not eligible for generation.` : "No new ideas to process. Exiting.";
      return new Response(JSON.stringify({ message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let successCount = 0;

    for (const idea of ideasToProcess) {
      try {
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đang xử lý' }).eq('id', idea.id);

        const { data: koc, error: kocError } = await supabaseAdmin
          .from('kocs')
          .select('name')
          .eq('id', idea.koc_id)
          .single();
        if (kocError || !koc) throw new Error(`KOC with id ${idea.koc_id} not found.`);

        const { data: templateData, error: templateError } = await supabaseAdmin
          .from('ai_prompt_templates')
          .select('*')
          .eq('id', (await supabaseAdmin.rpc('get_default_template_for_koc', { p_koc_id: idea.koc_id })).data[0].template_id)
          .single();
        
        if (templateError || !templateData) {
          throw new Error("No default AI prompt template found for this KOC, user, or system-wide.");
        }

        // **FIX:** Rebuild the detailed prompt using all fields from the template
        const fullPrompt = `
Bạn là một chuyên gia sáng tạo nội dung cho KOC tên là "${koc.name}".
Hãy phát triển ý tưởng sau đây thành một kịch bản video hoàn chỉnh:

**Ý tưởng gốc:**
---
${idea.idea_content}
---

**Yêu cầu chi tiết về kịch bản:**
- **Yêu cầu chung:** ${templateData.general_prompt || 'Không có'}
- **Tông giọng:** ${templateData.tone_of_voice || 'chuyên nghiệp, hấp dẫn'}
- **Văn phong:** ${templateData.writing_style || 'kể chuyện, sử dụng văn nói'}
- **Cách viết:** ${templateData.writing_method || 'sử dụng câu ngắn, đi thẳng vào vấn đề'}
- **Vai trò của bạn (AI):** ${templateData.ai_role || 'Một chuyên gia sáng tạo nội dung'}
- **Yêu cầu bắt buộc:** ${templateData.mandatory_requirements || 'Không có'}
- **Lời thoại ví dụ (tham khảo):** ${templateData.example_dialogue || 'Không có'}
- **Độ dài tối đa:** ${templateData.word_count ? `Không vượt quá ${templateData.word_count} từ.` : 'Giữ kịch bản ngắn gọn, súc tích.'}

**QUAN TRỌNG:** Chỉ trả về nội dung kịch bản hoàn chỉnh, không thêm bất kỳ lời giải thích, tiêu đề hay ghi chú nào khác.
`.trim();

        const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
        if (!credentialsJson) throw new Error("Secret GOOGLE_CREDENTIALS_JSON chưa được cấu hình trong Supabase Vault.");
        const credentials = JSON.parse(credentialsJson);
        const projectId = credentials.project_id;
        if (!projectId) throw new Error("Tệp JSON trong secret không chứa 'project_id'.");

        const accessToken = await getGcpAccessToken(credentials);
        const region = "us-central1";
        const model = templateData.model || "gemini-2.5-pro";
        const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

        const vertexResponse = await fetch(vertexUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ "role": "user", "parts": [{ "text": fullPrompt }] }],
            generationConfig: { temperature: 0.7, topK: 1, topP: 1, maxOutputTokens: 8192 },
          }),
        });

        if (!vertexResponse.ok) {
          const errorData = await vertexResponse.json();
          const errorBody = errorData.error?.message || JSON.stringify(errorData);
          throw new Error(`Lỗi từ Vertex AI (Status: ${vertexResponse.status}): ${errorBody}`);
        }

        const vertexData = await vertexResponse.json();
        if (!vertexData.candidates || vertexData.candidates.length === 0) {
          if (vertexData?.promptFeedback?.blockReason) throw new Error(`Nội dung bị chặn vì lý do an toàn: ${vertexData.promptFeedback.blockReason}.`);
          throw new Error("Lỗi từ Vertex AI: Phản hồi không chứa nội dung được tạo.");
        }

        const generatedText = vertexData.candidates[0].content.parts[0].text;

        const { error: updateError } = await supabaseAdmin
          .from('koc_content_ideas')
          .update({
            new_content: generatedText,
            status: 'Đã có content',
            ai_prompt_log: fullPrompt,
            error_message: null,
          })
          .eq('id', idea.id);
        
        if (updateError) throw new Error(`Error updating idea in DB: ${updateError.message}`);
        
        successCount++;

      } catch (processingError) {
        console.error(`Failed to process idea ${idea.id}:`, processingError.message);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Lỗi tạo content', error_message: processingError.message }).eq('id', idea.id);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Processed ${successCount}/${ideasToProcess.length} ideas.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Critical error in generate-idea-content function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});