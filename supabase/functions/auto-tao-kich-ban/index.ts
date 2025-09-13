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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lấy 5 bài viết mới nhất có trạng thái 'new' để xử lý
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('news_posts')
      .select('*')
      .eq('status', 'new')
      .order('created_time', { ascending: true })
      .limit(5);

    if (postsError) throw new Error(`Lỗi khi lấy tin tức mới: ${postsError.message}`);

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: "Không có tin tức mới để xử lý." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Tìm thấy ${posts.length} tin tức mới. Bắt đầu xử lý...`);

    for (const post of posts) {
      try {
        // Đánh dấu bài viết là đang xử lý để tránh bị lấy lại ở lần chạy sau
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'processing' })
          .eq('id', post.id);

        // Lấy cấu hình AI của người dùng
        const { data: aiConfig, error: configError } = await supabaseAdmin
          .from('ai_prompt_templates')
          .select('*')
          .eq('user_id', post.user_id)
          .single();
        
        if (configError) throw new Error(`Không tìm thấy cấu hình AI cho user ${post.user_id}`);

        // Tạo prompt chi tiết từ cấu hình, đồng bộ với form tạo content
        const detailedPrompt = `
- Tông giọng: ${aiConfig.tone_of_voice || 'chuyên nghiệp, hấp dẫn'}
- Văn phong: ${aiConfig.writing_style || 'kể chuyện, sử dụng văn nói'}
- Cách viết: ${aiConfig.writing_method || 'sử dụng câu ngắn, đi thẳng vào vấn đề'}
- Vai trò AI: ${aiConfig.ai_role || 'Một chuyên gia sáng tạo nội dung'}
- Yêu cầu bắt buộc: ${aiConfig.mandatory_requirements || 'Không có'}
- Cấu trúc trình bày: ${aiConfig.presentation_structure || 'Tự do'}
        `.trim();

        // Gọi function generate-video-script để tái sử dụng logic
        const { data: scriptData, error: scriptError } = await supabaseAdmin.functions.invoke('generate-video-script', {
          body: {
            userId: post.user_id,
            prompt: detailedPrompt,
            newsContent: post.content,
            kocName: "KOC", // Tên KOC có thể được lấy từ bảng khác nếu cần
            maxWords: aiConfig.word_count,
            model: aiConfig.model || "gemini-1.5-pro-latest",
          },
        });

        if (scriptError || !scriptData.success) {
          throw new Error(scriptError?.message || scriptData.error || "Lỗi khi tạo kịch bản.");
        }
        
        const generatedScript = scriptData.script;
        const usedPrompt = scriptData.prompt;

        // Cập nhật bài viết với kịch bản và trạng thái mới
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'script_generated', voice_script: generatedScript })
          .eq('id', post.id);

        // Lưu kịch bản vào CSDL, bao gồm cả prompt
        await supabaseAdmin.from('video_scripts').insert({
          user_id: post.user_id,
          name: `Tự động: ${post.content.substring(0, 50)}...`,
          news_post_id: post.id,
          script_content: generatedScript,
          ai_prompt: usedPrompt,
        });

        console.log(`Đã tạo kịch bản thành công cho tin tức ID: ${post.id}.`);

      } catch (processingError) {
        // Nếu có lỗi, cập nhật tin tức là 'failed' và ghi lại lỗi
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'failed', voice_script: `LỖI TẠO KỊCH BẢN: ${processingError.message}` })
          .eq('id', post.id);
        console.error(`Lỗi xử lý tin tức ID ${post.id}:`, processingError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Hoàn tất xử lý ${posts.length} tin tức.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-tao-kich-ban:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});