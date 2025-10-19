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

    // 1. Tìm các idea đang chờ voice hoàn thành
    const { data: ideas, error: fetchError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, user_id, koc_id, voice_task_id')
      .eq('status', 'Đang tạo voice')
      .not('voice_task_id', 'is', null)
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
        // 2. Kiểm tra trạng thái của voice task
        const { data: voiceTask, error: voiceTaskError } = await supabaseAdmin
          .from('voice_tasks')
          .select('status, audio_url')
          .eq('id', idea.voice_task_id)
          .single();

        if (voiceTaskError) throw new Error(`Không tìm thấy voice task ${idea.voice_task_id}: ${voiceTaskError.message}`);

        // 3. Nếu voice đã xong và có audio_url
        if (voiceTask.status === 'done' && voiceTask.audio_url) {
          console.log(`Voice task ${idea.voice_task_id} đã hoàn thành. Bắt đầu tạo video.`);
          
          // 4. Khóa idea lại
          await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đang tạo video', voice_audio_url: voiceTask.audio_url }).eq('id', idea.id);

          // 5. Lấy một video nguồn NGẪU NHIÊN của KOC bằng RPC
          const { data: sourceVideo, error: videoError } = await supabaseAdmin
            .rpc('get_random_source_video', { p_koc_id: idea.koc_id })
            .single();

          if (videoError || !sourceVideo) {
            throw new Error(`Không tìm thấy video nguồn nào cho KOC ${idea.koc_id}.`);
          }
          const sourceVideoUrl = `${R2_PUBLIC_URL}/${sourceVideo.r2_key}`;

          // 6. Tạo một task mới trong dreamface_tasks
          const { data: newDreamfaceTask, error: insertError } = await supabaseAdmin
            .from('dreamface_tasks')
            .insert({
              user_id: idea.user_id,
              koc_id: idea.koc_id,
              title: `AutoVideo for Idea ${idea.id.substring(0, 8)}`,
              status: 'pending', // Sẽ được xử lý bởi cron job dreamface-process-queue
              original_video_url: sourceVideoUrl,
              original_audio_url: voiceTask.audio_url,
            })
            .select('id')
            .single();

          if (insertError) throw new Error(`Lỗi tạo dreamface task: ${insertError.message}`);

          // 7. Liên kết dreamface_task_id với idea
          await supabaseAdmin.from('koc_content_ideas').update({ dreamface_task_id: newDreamfaceTask.id }).eq('id', idea.id);

          console.log(`Đã tạo dreamface task ${newDreamfaceTask.id} cho idea ${idea.id}.`);
          successCount++;
        }
      } catch (processingError) {
        console.error(`Lỗi xử lý idea ${idea.id}:`, processingError.message);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Lỗi tạo video', error_message: processingError.message }).eq('id', idea.id);
      }
    }
    return new Response(JSON.stringify({ success: true, message: `Đã xử lý ${successCount}/${ideas.length} ideas.` }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-voice-to-video:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});