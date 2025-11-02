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

    // 1. Tìm các idea đã sẵn sàng để tạo voice (có content, chưa có voice_task_id)
    const { data: ideas, error: fetchError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, user_id, new_content, koc_id')
      .eq('status', 'Đã có content')
      .is('voice_task_id', null)
      .limit(5); // Xử lý mỗi lần 5 idea để tránh timeout

    if (fetchError) throw new Error(`Lỗi khi tìm idea: ${fetchError.message}`);
    if (!ideas || ideas.length === 0) {
      return new Response(JSON.stringify({ message: "Không có idea mới để tạo voice." }), { status: 200, headers: corsHeaders });
    }

    console.log(`Tìm thấy ${ideas.length} idea để xử lý.`);
    let successCount = 0;

    for (const idea of ideas) {
      try {
        // 2. Kiểm tra xem có chiến dịch nào đang 'active' cho KOC này không
        const { data: campaign, error: campaignError } = await supabaseAdmin
          .from('automation_campaigns')
          .select('cloned_voice_id, cloned_voice_name')
          .eq('koc_id', idea.koc_id)
          .eq('status', 'active')
          .single();

        if (campaignError || !campaign) {
          console.log(`Bỏ qua idea ${idea.id} vì không có chiến dịch active cho KOC ${idea.koc_id}.`);
          continue;
        }

        // 3. Khóa idea lại bằng cách cập nhật status
        // Nếu bước này thành công, nhưng các bước sau thất bại, nó sẽ bị kẹt ở 'Đang tạo voice'
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đang tạo voice' }).eq('id', idea.id);

        // 4. Gọi API tạo voice và không chờ đợi
        const { data: voiceData, error: voiceError } = await supabaseAdmin.functions.invoke('voice-api-proxy', {
          body: {
            userId: idea.user_id,
            path: "v1m/task/text-to-speech",
            method: "POST",
            body: {
              text: idea.new_content,
              voice_name: `AutoVoice for Idea ${idea.id.substring(0, 8)}`,
              model: "speech-2.5-hd-preview",
              voice_setting: { voice_id: campaign.cloned_voice_id },
              cloned_voice_name: campaign.cloned_voice_name
            }
          }
        });

        if (voiceError || voiceData.error) throw new Error(voiceError?.message || voiceData.error);
        
        const taskId = voiceData.task_id;
        if (!taskId) throw new Error("API không trả về task_id.");

        // 5. Lưu lại voice_task_id để theo dõi
        await supabaseAdmin.from('koc_content_ideas').update({ voice_task_id: taskId }).eq('id', idea.id);
        
        console.log(`Đã gửi yêu cầu tạo voice thành công cho idea ${idea.id} với Task ID: ${taskId}.`);
        successCount++;

      } catch (processingError) {
        console.error(`Lỗi xử lý idea ${idea.id}:`, processingError.message);
        // Nếu lỗi, trả lại status về 'Đã có content' để có thể thử lại hoặc xử lý thủ công
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đã có content' }).eq('id', idea.id);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Đã xử lý thành công ${successCount}/${ideas.length} ideas.` }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-idea-to-voice:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});