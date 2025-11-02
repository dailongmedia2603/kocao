// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

        console.log(`Fetching shared API key...`);
        const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_api_keys").select("api_key").limit(1).single();
        if (apiKeyError || !apiKeyData) throw new Error("No Gemini API key is configured in the system.");
        const geminiApiKey = apiKeyData.api_key;
        console.log("API key found.");

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

        console.log(`Calling Gemini API with model: ${template.model || 'gemini-1.5-pro-latest'}`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${template.model || 'gemini-1.5-pro-latest'}:generateContent?key=${geminiApiKey}`;
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.7, topK: 1, topP: 1, maxOutputTokens: 8192 },
          }),
        });

        const geminiData = await geminiResponse.json();
        if (!geminiResponse.ok || !geminiData.candidates || geminiData.candidates.length === 0) {
          console.error("Gemini API error response:", JSON.stringify(geminiData));
          throw new Error(geminiData?.error?.message || "Lỗi từ API Gemini.");
        }
        const generatedText = geminiData.candidates[0].content.parts[0].text;
        console.log("Successfully received response from Gemini.");

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
        // SỬA LỖI: Thay vì reset, hãy đặt trạng thái lỗi để không làm mất tiến trình.
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