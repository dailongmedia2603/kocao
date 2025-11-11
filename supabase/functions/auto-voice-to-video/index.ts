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

        // 3. Gọi hàm SQL trung tâm để kiểm tra, trừ credit và tạo tác vụ
        console.log(`Voice cho idea ${idea.id} đã hoàn thành. Bắt đầu quy trình tạo video và trừ credit.`);
        
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('check_and_deduct_credit', {
          p_user_id: idea.user_id,
          p_koc_id: idea.koc_id,
          p_idea_id: idea.id,
        });

        if (rpcError) {
            throw new Error(`Lỗi RPC 'check_and_deduct_credit': ${rpcError.message}`);
        }

        const result = rpcData[0];
        if (!result.success) {
            // Nếu RPC thất bại (ví dụ: hết credit), ném lỗi để cập nhật trạng thái idea
            throw new Error(result.message);
        }

        console.log(`Đã gửi yêu cầu tạo video thành công cho idea ${idea.id}. Task ID: ${result.new_task_id}.`);
        successCount++;
        
      } catch (processingError) {
        console.error(`Lỗi xử lý idea ${idea.id}:`, processingError.message);
        // Nếu có lỗi, cập nhật trạng thái để dễ dàng theo dõi
        await supabaseAdmin
          .from('koc_content_ideas')
          .update({ status: 'Lỗi tạo video', error_message: processingError.message })
          .eq('id', idea.id);
      }
    }
    return new Response(JSON.stringify({ success: true, message: `Đã xử lý ${successCount}/${ideas.length} ideas.` }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Lỗi nghiêm trọng trong auto-voice-to-video:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});