// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-control-allow-origin": "*",
  "Access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
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
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_PUBLIC_URL) throw new Error("Thiếu cấu hình R2_PUBLIC_URL.");

    // 1. Tìm các idea đã tạo voice xong nhưng chưa bắt đầu tạo video
    const { data: ideas, error: fetchError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, user_id, koc_id, voice_audio_url')
      .eq('status', 'Đã tạo voice')
      .not('voice_audio_url', 'is', null)
      .is('dreamface_task_id', null)
      .limit(5);

    if (fetchError) throw new Error(`Lỗi khi tìm idea: ${fetchError.message}`);
    if (!ideas || ideas.length === 0) {
      return new Response(JSON.stringify({ message: "Không có voice nào hoàn thành để xử lý." }), { status: 200, headers: corsHeaders });
    }

    console.log(`Tìm thấy ${ideas.length} idea để xử lý.`);
    let successCount = 0;

    for (const idea of ideas) {
      try {
        // 2. KIỂM TRA XEM CÓ CHIẾN DỊCH NÀO ĐANG 'ACTIVE' CHO KOC NÀY KHÔNG
        const { data: campaign, error: campaignError } = await supabaseAdmin
          .from('automation_campaigns')
          .select('id')
          .eq('koc_id', idea.koc_id)
          .eq('status', 'active')
          .single();

        // Nếu không có chiến dịch active, bỏ qua idea này
        if (campaignError || !campaign) {
          console.log(`Bỏ qua idea ${idea.id} vì không có chiến dịch active cho KOC ${idea.koc_id}.`);
          continue;
        }

        // 3. Khóa idea lại để tránh xử lý trùng lặp
        console.log(`Voice cho idea ${idea.id} đã hoàn thành. Bắt đầu tạo video.`);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đang tạo video' }).eq('id', idea.id);

        // 4. Lấy video nguồn tiếp theo một cách tuần tự
        const { data: sourceVideo, error: videoError } = await supabaseAdmin
          .rpc('get_and_update_next_source_video', { p_koc_id: idea.koc_id })
          .single();

        if (videoError || !sourceVideo) {
          throw new Error(`Không tìm thấy video nguồn nào cho KOC ${idea.koc_id}. Vui lòng tải video nguồn lên.`);
        }
        const sourceVideoUrl = `${R2_PUBLIC_URL}/${sourceVideo.r2_key}`;

        // 5. Tạo một tác vụ mới trong dreamface_tasks
        const { data: newDreamfaceTask, error: insertError } = await supabaseAdmin
          .from('dreamface_tasks')
          .insert({
            user_id: idea.user_id,
            koc_id: idea.koc_id,
            title: `AutoVideo for Idea ${idea.id.substring(0, 8)}`,
            status: 'pending', // Sẽ được xử lý bởi cron job khác
            original_video_url: sourceVideoUrl,
            original_audio_url: idea.voice_audio_url, // Sử dụng audio_url đã có
          })
          .select('id')
          .single();

        if (insertError) throw new Error(`Lỗi tạo dreamface task: ${insertError.message}`);

        // 6. Liên kết dreamface_task_id với idea
        await supabaseAdmin.from('koc_content_ideas').update({ dreamface_task_id: newDreamfaceTask.id }).eq('id', idea.id);

        console.log(`Đã tạo dreamface task ${newDreamfaceTask.id} cho idea ${idea.id}.`);
        successCount++;
        
      } catch (processingError) {
        console.error(`Lỗi xử lý idea ${idea.id}:`, processingError.message);
        // Nếu có lỗi, cập nhật trạng thái để dễ dàng theo dõi
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Lỗi tạo video', error_message: processingError.message }).eq('id', idea.id);
      }
    }
    return new Response(JSON.stringify({ success: true, message: `Đã xử lý ${successCount}/${ideas.length} ideas.` }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-voice-to-video:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});