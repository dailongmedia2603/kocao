// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

        // Get the token from environment variables (Supabase secrets)
        const apiToken = Deno.env.get("GEMINI_CUSTOM_TOKEN");
        if (!apiToken) {
          throw new Error("GEMINI_CUSTOM_TOKEN secret is not set in Supabase Vault.");
        }

        // Create a new FormData for the external API call
        const externalApiFormData = new FormData();
        externalApiFormData.append("prompt", fullPrompt);
        externalApiFormData.append("token", apiToken);

        const response = await fetch("https://aquarius.qcv.vn/api/chat", {
          method: "POST",
          body: externalApiFormData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error from external API: ${response.status} - ${errorText}`);
        }

        const responseData = await response.json();
        if (!responseData.answer) {
            throw new Error("API did not return an 'answer' field.");
        }
        const generatedText = responseData.answer;

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