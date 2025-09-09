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

    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from('automation_campaigns')
      .select('*')
      .eq('status', 'active');

    if (campaignError) throw new Error(`Lỗi khi lấy chiến dịch: ${campaignError.message}`);
    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: "Không có chiến dịch nào đang hoạt động." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Tìm thấy ${campaigns.length} chiến dịch đang hoạt động. Bắt đầu xử lý...`);

    for (const campaign of campaigns) {
      const { data: newsPost, error: newsError } = await supabaseAdmin
        .from('news_posts')
        .select('*')
        .eq('user_id', campaign.user_id)
        .eq('status', 'new')
        .order('created_time', { ascending: true })
        .limit(1)
        .single();

      if (!newsPost) {
        console.log(`Không có tin mới cho chiến dịch '${campaign.name}'. Bỏ qua.`);
        continue;
      }

      console.log(`Đang xử lý tin tức ID: ${newsPost.id} cho chiến dịch '${campaign.name}'...`);

      await supabaseAdmin
        .from('news_posts')
        .update({ status: 'processing' })
        .eq('id', newsPost.id);

      try {
        // BƯỚC 2: TẠO KỊCH BẢN
        const { data: scriptData, error: scriptError } = await supabaseAdmin.functions.invoke('generate-video-script', {
          body: {
            userId: campaign.user_id,
            prompt: campaign.ai_prompt,
            newsContent: newsPost.content,
            kocName: "KOC", // Sẽ được thay thế bằng tên KOC thật
            maxWords: campaign.max_words,
            model: campaign.model,
          },
        });

        if (scriptError || !scriptData.success) {
          throw new Error(scriptError?.message || scriptData.error || "Lỗi khi tạo kịch bản.");
        }
        const generatedScript = scriptData.script;

        // Lưu kịch bản vào CSDL
        await supabaseAdmin.from('video_scripts').insert({
          user_id: campaign.user_id,
          name: `Tự động: ${newsPost.content.substring(0, 50)}...`,
          koc_id: campaign.koc_id,
          news_post_id: newsPost.id,
          script_content: generatedScript,
        });

        // CẬP NHẬT TRẠNG THÁI TIN TỨC THÀNH 'script_generated'
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'script_generated', voice_script: generatedScript })
          .eq('id', newsPost.id);
        
        console.log(`Đã tạo kịch bản thành công cho tin tức ID: ${newsPost.id}.`);

      } catch (processingError) {
        // Nếu có lỗi, cập nhật tin tức là 'failed' và ghi lại lỗi
        await supabaseAdmin
          .from('news_posts')
          .update({ status: 'failed', voice_script: `LỖI TẠO KỊCH BẢN: ${processingError.message}` })
          .eq('id', newsPost.id);
        console.error(`Lỗi xử lý tin tức ID ${newsPost.id}:`, processingError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Hoàn tất chu trình kiểm tra chiến dịch." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Lỗi nghiêm trọng trong run-automation-campaigns:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});