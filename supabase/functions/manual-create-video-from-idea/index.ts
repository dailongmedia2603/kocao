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
  
  const { ideaId } = await req.json().catch(() => ({}));

  try {
    if (!ideaId) throw new Error("Idea ID is required.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Lấy thông tin idea để có user_id và koc_id
    const { data: idea, error: ideaError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, user_id, koc_id, voice_audio_url')
      .eq('id', ideaId)
      .single();

    if (ideaError || !idea) throw new Error(`Không tìm thấy Idea với ID ${ideaId}.`);
    if (!idea.voice_audio_url) throw new Error("Idea này không có file âm thanh để tạo video.");

    // 2. Gọi hàm RPC trung tâm để xử lý mọi thứ
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('check_and_deduct_credit', {
        p_user_id: idea.user_id,
        p_koc_id: idea.koc_id,
        p_idea_id: idea.id,
        p_audio_url: idea.voice_audio_url,
      });

    if (rpcError) {
      throw new Error(`Lỗi RPC: ${rpcError.message}`);
    }

    const result = rpcData[0];
    if (!result.success) {
      throw new Error(result.message);
    }

    console.log(`Đã gửi yêu cầu tạo video thủ công cho idea ${idea.id}. Task ID mới: ${result.new_task_id}`);
    
    return new Response(JSON.stringify({ success: true, message: result.message }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Lỗi trong manual-create-video-from-idea:", error);
    // Nếu có lỗi, cập nhật trạng thái idea để phản ánh lỗi
    if (ideaId) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Lỗi tạo video', error_message: error.message }).eq('id', ideaId);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});