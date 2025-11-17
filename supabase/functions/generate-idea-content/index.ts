// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'npm:jose@^5.2.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGoogleAccessToken(credentials) {
  const privateKey = await jose.importPKCS8(credentials.private_key, 'RS256');
  const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(credentials.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime('1h')
    .sign(privateKey);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Auth Error: ${response.status} ${errorText}`);
  }
  const { access_token } = await response.json();
  return access_token;
}

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

        let generatedText = "";
        let modelUsed = "gemini-custom";

        try {
          console.log(`Attempting to generate content for idea ${idea.id} using Gemini Custom...`);
          const externalApiFormData = new FormData();
          externalApiFormData.append("prompt", fullPrompt);
          const { data: responseData, error: functionError } = await supabaseAdmin.functions.invoke("gemini-custom-proxy", {
            body: externalApiFormData,
          });

          if (functionError) throw new Error(`Error invoking gemini-custom-proxy: ${functionError.message}`);
          if (responseData.error) throw new Error(`Error from gemini-custom-proxy: ${responseData.error}`);
          if (!responseData.answer) throw new Error("Gemini Custom API did not return an 'answer' field.");
          
          generatedText = responseData.answer;
          console.log(`Successfully generated content for idea ${idea.id} using Gemini Custom.`);

        } catch (geminiError) {
          console.warn(`Gemini Custom failed for idea ${idea.id}: ${geminiError.message}. Attempting fallback to Vertex AI...`);
          modelUsed = "vertex-ai";

          // Find an admin user to get shared credentials
          const { data: adminUser, error: adminError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (adminError || !adminUser) {
            throw new Error("Gemini Custom failed and no admin account is configured for Vertex AI fallback.");
          }

          const { data: credData, error: credError } = await supabaseAdmin
            .from('user_vertex_ai_credentials')
            .select('credentials')
            .eq('user_id', adminUser.id) // Use admin's user_id
            .limit(1)
            .single();

          if (credError || !credData) {
            throw new Error("Gemini Custom failed and no Vertex AI credential is configured for the admin account.");
          }

          const credentials = credData.credentials;
          const projectId = credentials.project_id;
          if (!projectId) throw new Error("The provided credentials JSON is missing the 'project_id' field.");

          const accessToken = await getGoogleAccessToken(credentials);
          const vertexUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent`;
          
          const vertexResponse = await fetch(vertexUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: fullPrompt }] }] }),
          });

          if (!vertexResponse.ok) {
            const errorText = await vertexResponse.text();
            throw new Error(`Vertex AI API Error: ${vertexResponse.status} ${errorText}`);
          }

          const vertexData = await vertexResponse.json();
          generatedText = vertexData?.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";
          console.log(`Successfully generated content for idea ${idea.id} using Vertex AI fallback.`);
        }

        const { error: updateError } = await supabaseAdmin
          .from('koc_content_ideas')
          .update({
            new_content: generatedText,
            status: 'Đã có content',
            ai_prompt_log: `[Model Used: ${modelUsed}]\n\n${fullPrompt}`,
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