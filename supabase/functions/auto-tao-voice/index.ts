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

    // Lấy 5 bài viết đã có kịch bản để xử lý
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('news_posts')
      .select('*')
      .eq('status', 'script_generated')
      .order('created_time', { ascending: true })
      .limit(5);

    if (postsError) throw new Error(`Lỗi khi lấy kịch bản mới: ${postsError.message}`);

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: "Không có kịch bản mới để tạo voice." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Tìm thấy ${posts.length} kịch bản mới. Bắt đầu tạo voice...`);

    for (const post of posts) {
      try {
        // Đánh dấu là đang xử lý voice
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'voice_processing' })
          .eq('id', post.id);

        // Tìm bất kỳ chiến dịch tự động nào của người dùng này (bỏ qua trạng thái 'active')
        const { data: campaign, error: campaignError } = await supabaseAdmin
          .from('automation_campaigns')
          .select('cloned_voice_id, cloned_voice_name')
          .eq('user_id', post.user_id)
          .limit(1)
          .single();

        if (campaignError || !campaign) {
          throw new Error(`Không tìm thấy bất kỳ chiến dịch tự động nào được cấu hình cho user ${post.user_id}`);
        }

        // Gọi API để tạo voice
        const { data: voiceData, error: voiceError } = await supabaseAdmin.functions.invoke('voice-api-proxy', {
          body: {
            path: "v1m/task/text-to-speech",
            method: "POST",
            body: {
              text: post.voice_script,
              voice_name: `AutoVoice: ${post.content.substring(0, 30)}...`,
              model: "speech-2.5-hd-preview",
              voice_setting: { voice_id: campaign.cloned_voice_id }
            }
          }
        });

        if (voiceError || voiceData.error) {
          throw new Error(voiceError?.message || voiceData.error || "Lỗi khi gọi API tạo voice.");
        }

        const taskId = voiceData.task_id;
        if (!taskId) {
          throw new Error("API không trả về task_id.");
        }

        // Cập nhật bài viết với task_id và trạng thái mới
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'voice_generated', voice_task_id: taskId })
          .eq('id', post.id);

        console.log(`Đã tạo voice thành công cho tin tức ID: ${post.id} với Task ID: ${taskId}.`);

      } catch (processingError) {
        // Nếu có lỗi, cập nhật tin tức là 'failed' và ghi lại lỗi
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'voice_failed', voice_script: `LỖI TẠO VOICE: ${processingError.message}` })
          .eq('id', post.id);
        console.error(`Lỗi xử lý voice cho tin tức ID ${post.id}:`, processingError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Hoàn tất xử lý ${posts.length} kịch bản.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-tao-voice:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});