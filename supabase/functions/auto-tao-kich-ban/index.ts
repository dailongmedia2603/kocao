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

    // Nhóm các bài viết theo user_id
    const postsByUser = posts.reduce((acc, post) => {
      if (!acc[post.user_id]) {
        acc[post.user_id] = [];
      }
      acc[post.user_id].push(post);
      return acc;
    }, {});

    // Xử lý cho từng người dùng
    for (const userId in postsByUser) {
      const userPosts = postsByUser[userId];

      // Lấy danh sách KOC của người dùng này
      const { data: kocs, error: kocsError } = await supabaseAdmin
        .from('kocs')
        .select('id, name')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (kocsError || !kocs || kocs.length === 0) {
        console.error(`Không tìm thấy KOC nào cho user ${userId}. Bỏ qua ${userPosts.length} tin tức.`);
        continue; // Bỏ qua nếu người dùng không có KOC
      }

      let kocIndex = 0; // Biến đếm để phân phối luân phiên

      for (const post of userPosts) {
        const assignedKoc = kocs[kocIndex];
        
        try {
          // Đánh dấu bài viết là đang xử lý
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

          const detailedPrompt = `...`; // (Logic tạo prompt giữ nguyên)

          // Gọi function generate-video-script với tên KOC cụ thể
          const { data: scriptData, error: scriptError } = await supabaseAdmin.functions.invoke('generate-video-script', {
            body: {
              userId: post.user_id,
              prompt: detailedPrompt,
              newsContent: post.content,
              kocName: assignedKoc.name, // **SỬ DỤNG TÊN KOC ĐÃ GÁN**
              maxWords: aiConfig.word_count,
              model: aiConfig.model || "gemini-2.5-pro",
            },
          });

          if (scriptError || !scriptData.success) {
            throw new Error(scriptError?.message || scriptData.error || "Lỗi khi tạo kịch bản.");
          }
          
          const generatedScript = scriptData.script;
          const usedPrompt = scriptData.prompt;

          // Cập nhật bài viết
          await supabaseAdmin
            .from('news_posts')
            .update({ status: 'script_generated', voice_script: generatedScript })
            .eq('id', post.id);

          // Lưu kịch bản vào CSDL với KOC ID chính xác
          await supabaseAdmin.from('video_scripts').insert({
            user_id: post.user_id,
            name: `Tự động: ${post.content.substring(0, 50)}...`,
            news_post_id: post.id,
            koc_id: assignedKoc.id, // **GÁN KOC ID VÀO KỊCH BẢN**
            script_content: generatedScript,
            ai_prompt: usedPrompt,
          });

          console.log(`Đã tạo kịch bản cho KOC '${assignedKoc.name}' từ tin tức ID: ${post.id}.`);

        } catch (processingError) {
          await supabaseAdmin
            .from('news_posts')
            .update({ status: 'failed', voice_script: `LỖI TẠO KỊCH BẢN: ${processingError.message}` })
            .eq('id', post.id);
          console.error(`Lỗi xử lý tin tức ID ${post.id}:`, processingError.message);
        }

        // Chuyển sang KOC tiếp theo cho bài viết sau
        kocIndex = (kocIndex + 1) % kocs.length;
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Hoàn tất xử lý ${posts.length} tin tức.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-tao-kich-ban:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});