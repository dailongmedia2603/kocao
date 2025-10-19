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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find new ideas that need content generation
    console.log("Fetching ideas to process...");
    const { data: ideasToProcess, error: fetchError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, user_id, idea_content, koc_id')
      .eq('status', 'Chưa sử dụng')
      .or('new_content.is.null,new_content.eq.') // SỬA LỖI: Tìm cả NULL hoặc chuỗi rỗng
      .limit(5); // Process 5 at a time to avoid timeouts

    if (fetchError) {
      console.error("Error fetching ideas:", fetchError.message);
      throw new Error(`Error fetching ideas: ${fetchError.message}`);
    }

    if (!ideasToProcess || ideasToProcess.length === 0) {
      console.log("No new ideas to process. Exiting.");
      return new Response(JSON.stringify({ message: "No new ideas to process." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${ideasToProcess.length} new ideas to process.`);
    let successCount = 0;

    for (const idea of ideasToProcess) {
      try {
        console.log(`Processing idea ID: ${idea.id}`);
        // 2. Lock the idea to prevent reprocessing
        await supabaseAdmin
          .from('koc_content_ideas')
          .update({ status: 'Đang xử lý' })
          .eq('id', idea.id);

        // 3. Get user's Gemini API key
        console.log(`Fetching API key for user ID: ${idea.user_id}`);
        const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
          .from("user_api_keys")
          .select("api_key")
          .eq("user_id", idea.user_id)
          .limit(1)
          .single();
        if (apiKeyError || !apiKeyData) throw new Error("User has no Gemini API key configured.");
        const geminiApiKey = apiKeyData.api_key;
        console.log("API key found.");

        // 4. Get user's default AI prompt template
        console.log("Fetching default prompt template...");
        const { data: template, error: templateError } = await supabaseAdmin
          .from('ai_prompt_templates')
          .select('*')
          .eq('user_id', idea.user_id)
          .eq('is_default', true)
          .single();
        if (templateError || !template) throw new Error("User has no default AI prompt template set.");
        console.log(`Found default template: "${template.name}"`);

        // 5. Get KOC's name
        console.log(`Fetching KOC name for ID: ${idea.koc_id}`);
        const { data: koc, error: kocError } = await supabaseAdmin
          .from('kocs')
          .select('name')
          .eq('id', idea.koc_id)
          .single();
        if (kocError || !koc) throw new Error(`KOC with id ${idea.koc_id} not found.`);
        console.log(`Found KOC name: "${koc.name}"`);

        // 6. Construct the full prompt
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

        // 7. Call Gemini API
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

        // 8. Update the idea in the database
        console.log(`Updating idea ${idea.id} with new content.`);
        const { error: updateError } = await supabaseAdmin
          .from('koc_content_ideas')
          .update({
            new_content: generatedText,
            status: 'Đã có content'
          })
          .eq('id', idea.id);
        
        if (updateError) throw new Error(`Error updating idea in DB: ${updateError.message}`);
        
        successCount++;
        console.log(`Successfully generated content for idea ${idea.id}.`);

      } catch (processingError) {
        console.error(`Failed to process idea ${idea.id}:`, processingError.message);
        // Revert status to allow retrying later
        await supabaseAdmin
          .from('koc_content_ideas')
          .update({ status: 'Chưa sử dụng' })
          .eq('id', idea.id);
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