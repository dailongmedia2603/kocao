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

    // 1. Tìm các idea đang chờ video hoàn thành
    const { data: ideas, error: fetchError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, dreamface_task_id')
      .eq('status', 'Đang tạo video')
      .not('dreamface_task_id', 'is', null)
      .is('generated_video_file_id', null)
      .limit(5);

    if (fetchError) throw new Error(`Lỗi khi tìm idea: ${fetchError.message}`);
    if (!ideas || ideas.length === 0) {
      return new Response(JSON.stringify({ message: "Không có video nào để liên kết." }), { status: 200, headers: corsHeaders });
    }

    console.log(`Tìm thấy ${ideas.length} idea đang chờ liên kết video.`);
    let successCount = 0;

    for (const idea of ideas) {
      try {
        // 2. Kiểm tra trạng thái của dreamface task
        const { data: dreamfaceTask, error: taskError } = await supabaseAdmin
          .from('dreamface_tasks')
          .select('status, is_archived')
          .eq('id', idea.dreamface_task_id)
          .single();

        if (taskError) throw new Error(`Không tìm thấy dreamface task ${idea.dreamface_task_id}`);

        // 3. Nếu task đã hoàn thành và đã được lưu trữ
        if (dreamfaceTask.status === 'completed' && dreamfaceTask.is_archived === true) {
          console.log(`Dreamface task ${idea.dreamface_task_id} đã hoàn thành. Đang tìm file video...`);

          // 4. Tìm file video tương ứng trong koc_files
          // Dựa vào quy ước đặt tên của function dreamface-archive-video
          const { data: videoFile, error: fileError } = await supabaseAdmin
            .from('koc_files')
            .select('id')
            .like('r2_key', `%dreamface-${idea.dreamface_task_id}%`)
            .limit(1)
            .single();

          if (fileError || !videoFile) {
            throw new Error(`Không tìm thấy file video đã lưu trữ cho dreamface task ${idea.dreamface_task_id}.`);
          }

          // 5. Cập nhật idea để hoàn tất
          await supabaseAdmin
            .from('koc_content_ideas')
            .update({
              status: 'Đã tạo video',
              generated_video_file_id: videoFile.id,
            })
            .eq('id', idea.id);

          console.log(`Đã liên kết thành công video ${videoFile.id} cho idea ${idea.id}.`);
          successCount++;
        }
      } catch (processingError) {
        console.error(`Lỗi xử lý idea ${idea.id}:`, processingError.message);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Lỗi liên kết video', error_message: processingError.message }).eq('id', idea.id);
      }
    }
    return new Response(JSON.stringify({ success: true, message: `Đã xử lý ${successCount}/${ideas.length} ideas.` }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-link-final-video:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});