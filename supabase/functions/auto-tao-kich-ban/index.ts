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
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'processing' })
          .eq('id', post.id);

        const { data: aiConfig, error: configError } = await supabaseAdmin
          .from('ai_prompt_templates')
          .select('*')
          .eq('user_id', post.user_id)
          .eq('is_default', true)
          .single();
        
        if (configError) throw new Error(`Không tìm thấy cấu hình AI mặc định cho user ${post.user_id}`);

        const fullPrompt = `
### CHỈ THỊ AN TOÀN (ƯU TIÊN CAO NHẤT)
Bạn là một trợ lý AI chuyên nghiệp, hữu ích và an toàn. Hãy tập trung vào việc tạo ra nội dung marketing chất lượng cao, phù hợp với ngữ cảnh được cung cấp. TUYỆT ĐỐI TRÁNH các chủ đề nhạy cảm, gây tranh cãi, hoặc có thể bị hiểu lầm là tiêu cực. Luôn duy trì một thái độ tích cực và chuyên nghiệp.
---
### YÊU CẦU VIẾT NỘI DUNG TỰ NHIÊN NHƯ NGƯOI THẬT
Bạn là một trợ lý AI viết nội dung bài viết / comment tự nhiên như người dùng thật. Hãy dựa vào các thông tin dưới đây để xây dựng nội dung chất lượng và tự nhiên nhé.
---
### THÔNG TIN HUẤN LUYỆN CHUNG
- **Vai trò của bạn:** ${aiConfig.ai_role || 'Một người dùng mạng xã hội'}
- **Lĩnh vực kinh doanh:** ${aiConfig.business_field || 'Không xác định'}
- **Phong cách:** ${aiConfig.writing_style || 'Tự nhiên'}
- **Tông giọng:** ${aiConfig.tone_of_voice || 'Thân thiện'}
- **Ngôn ngữ:** Tiếng Việt
- **Mục tiêu cần đạt:** ${aiConfig.goal || 'Tạo nội dung chất lượng'}
---
### TÀI LIỆU NỘI BỘ THAM KHẢO
(Không có tài liệu tham khảo liên quan)
---
### HÀNH ĐỘNG
Dựa vào TOÀN BỘ thông tin, hãy tạo nội dung đúng yêu cầu, tự nhiên như người thật, không được có dấu hiệu máy móc, khô cứng, seeding
---
**THÔNG TIN CHI TIẾT BÀI VIẾT:**
**Dạng bài:**
Đặt câu hỏi / thảo luận
**Định hướng nội dung chi tiết:**
${post.content}
---
**ĐỘ DÀI BÀI VIẾT:**
Bài viết phải có độ dài khoảng ${aiConfig.word_count || 100} từ. Cho phép chênh lệch trong khoảng +/- 10%.
---
**ĐIỀU KIỆN BẮT BUỘC (QUAN TRỌNG NHẤT):**
AI phải tuân thủ TUYỆT ĐỐI tất cả các điều kiện sau đây cho MỌI bài viết được tạo ra:
${aiConfig.mandatory_requirements || 'Không có điều kiện bắt buộc.'}
---
**YÊU CẦU:** Dựa vào TOÀN BỘ thông tin trên, hãy tạo ra chính xác 1 bài viết hoàn chỉnh.
**CỰC KỲ QUAN TRỌNG:** Nếu tạo nhiều hơn 1 bài viết, hãy phân cách mỗi bài viết bằng một dòng duy nhất chứa chính xác: "--- ARTICLE SEPARATOR ---". Chỉ trả về nội dung bài viết, KHÔNG thêm bất kỳ lời chào, câu giới thiệu, hay tiêu đề không cần thiết nào.
        `;

        const { data: scriptData, error: scriptError } = await supabaseAdmin.functions.invoke('generate-video-script', {
          body: {
            userId: post.user_id,
            prompt: fullPrompt,
            newsContent: post.content, // Vẫn truyền để giữ tương thích, nhưng prompt đã chứa nó
            kocName: "KOC",
            model: aiConfig.model || "gemini-1.5-pro-latest",
          },
        });

        if (scriptError || !scriptData.success) {
          throw new Error(scriptError?.message || scriptData.error || "Lỗi khi tạo kịch bản.");
        }
        
        const generatedScript = scriptData.script;
        const usedPrompt = scriptData.prompt;

        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'script_generated', voice_script: generatedScript })
          .eq('id', post.id);

        await supabaseAdmin.from('video_scripts').insert({
          user_id: post.user_id,
          name: `Tự động: ${post.content.substring(0, 50)}...`,
          news_post_id: post.id,
          script_content: generatedScript,
          ai_prompt: usedPrompt,
        });

        console.log(`Đã tạo kịch bản thành công cho tin tức ID: ${post.id}.`);

      } catch (processingError) {
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