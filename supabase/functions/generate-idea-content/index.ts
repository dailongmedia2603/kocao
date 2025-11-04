// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
  
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    dataToSign
  );

  const jwt = `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;

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
// --- END: Vertex AI Helper Functions ---


serve(async (req) => {
  console.log(`[${new Date().toISOString()}] generate-idea-content function invoked with method: ${req.method}`);

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ideaId } = await req.json().catch(() => ({})); // Safely get body
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let ideasToProcess;
    let fetchError;

    if (ideaId) {
      // If a specific ideaId is provided, fetch only that one
      console.log(`Fetching specific idea ID: ${ideaId}`);
      const { data, error } = await supabaseAdmin
        .from('koc_content_ideas')
        .select('id, user_id, idea_content, koc_id, status') // Select status as well
        .eq('id', ideaId)
        .limit(1);
      ideasToProcess = data;
      fetchError = error;
    } else {
      // Otherwise, fetch the queue as before
      console.log("Fetching ideas to process from queue...");
      const { data, error } = await supabaseAdmin
        .from('koc_content_ideas')
        .select('id, user_id, idea_content, koc_id, status')
        .eq('status', 'Chưa sử dụng')
        .limit(5);
      ideasToProcess = data;
      fetchError = error;
    }

    if (fetchError) {
      console.error("Error fetching ideas:", fetchError.message);
      throw new Error(`Error fetching ideas: ${fetchError.message}`);
    }

    if (!ideasToProcess || ideasToProcess.length === 0) {
      const message = ideaId ? `Idea with ID ${ideaId} not found or not eligible for generation.` : "No new ideas to process. Exiting.";
      console.log(message);
      return new Response(JSON.stringify({ message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${ideasToProcess.length} ideas to process.`);
    let successCount = 0;

    for (const idea of ideasToProcess) {
      try {
        // Double-check the status before processing to prevent reprocessing
        if (idea.status !== 'Chưa sử dụng') {
          console.log(`Skipping idea ${idea.id} because its status is already '${idea.status}'.`);
          continue;
        }

        console.log(`Processing idea ID: ${idea.id}`);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đang xử lý' }).eq('id', idea.id);

        // --- START: Vertex AI Authentication ---
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
        console.log("Vertex AI access token obtained.");
        // --- END: Vertex AI Authentication ---

        console.log(`Fetching KOC data for ID: ${idea.koc_id}`);
        const { data: koc, error: kocError } = await supabaseAdmin
          .from('kocs')
          .select('name, default_prompt_template_id')
          .eq('id', idea.koc_id)
          .single();
        if (kocError || !koc) throw new Error(`KOC with id ${idea.koc_id} not found.`);
        console.log(`Found KOC name: "${koc.name}"`);

        let template;
        let templateError;

        if (koc.default_prompt_template_id) {
          console.log(`Fetching KOC-specific default template ID: ${koc.default_prompt_template_id}`);
          ({ data: template, error: templateError } = await supabaseAdmin
            .from('ai_prompt_templates')
            .select('*')
            .eq('id', koc.default_prompt_template_id)
            .single());
        }

        if (!template) {
          console.log("No KOC-specific template found, falling back to user default.");
          ({ data: template, error: templateError } = await supabaseAdmin
            .from('ai_prompt_templates')
            .select('*')
            .eq('user_id', idea.user_id)
            .eq('is_default', true)
            .single());
        }

        if (templateError || !template) {
          throw new Error("No default AI prompt template found for this KOC or user.");
        }
        console.log(`Using template: "${template.name}"`);

        const fullPrompt = `
          Bạn là một chuyên gia sáng tạo nội dung cho KOC tên là "${koc.name}".
          Hãy phát triển ý tưởng sau đây thành một kịch bản video hoàn chỉnh:
          
          **Ý tưởng gốc:**
          ---
          ${idea.idea_content}
          ---

          **Yêu cầu chi tiết về kịch bản:**
          - **Yêu cầu chung:** ${template.general_prompt || 'Không có'}
          - **Tông giọng:** ${template.tone_of_voice || 'Tự nhiên, hấp dẫn'}
          - **Văn phong:** ${template.writing_style || 'Kể chuyện, gần gũi'}
          - **Cách viết:** ${template.writing_method || 'Sử dụng câu ngắn, dễ hiểu'}
          - **Vai trò của bạn (AI):** ${template.ai_role || 'Một người bạn đang chia sẻ câu chuyện'}
          - **Yêu cầu bắt buộc:** ${template.mandatory_requirements || 'Không có'}
          - **Lời thoại ví dụ (tham khảo):** ${template.example_dialogue || 'Không có'}
          - **Độ dài tối đa:** ${template.word_count ? `Không vượt quá ${template.word_count} từ.` : 'Ngắn gọn, súc tích.'}

          **QUAN TRỌNG:** Chỉ trả về nội dung kịch bản hoàn chỉnh, không thêm bất kỳ lời giải thích, tiêu đề hay ghi chú nào khác.
        `;

        // --- START: Vertex AI API Call ---
        const region = "us-central1";
        const model = template.model || 'gemini-2.5-pro'; // Default to a valid model
        console.log(`Calling Vertex AI with model: ${model}`);
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
          const errorBody = await vertexResponse.text();
          console.error("Vertex AI API error response:", errorBody);
          throw new Error(`Lỗi từ Vertex AI (Status: ${vertexResponse.status}): ${errorBody}`);
        }

        const vertexData = await vertexResponse.json();
        if (!vertexData.candidates || vertexData.candidates.length === 0) {
          console.error("Vertex AI API empty response:", JSON.stringify(vertexData));
          throw new Error(vertexData?.error?.message || "Lỗi từ Vertex AI: Phản hồi không chứa nội dung.");
        }
        const generatedText = vertexData.candidates[0].content.parts[0].text;
        console.log("Successfully received response from Vertex AI.");
        // --- END: Vertex AI API Call ---

        console.log(`Updating idea ${idea.id} with new content.`);
        const { error: updateError } = await supabaseAdmin
          .from('koc_content_ideas')
          .update({
            new_content: generatedText,
            status: 'Đã có content',
            ai_prompt_log: fullPrompt
          })
          .eq('id', idea.id);
        
        if (updateError) throw new Error(`Error updating idea in DB: ${updateError.message}`);
        
        successCount++;
        console.log(`Successfully generated content for idea ${idea.id}.`);

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