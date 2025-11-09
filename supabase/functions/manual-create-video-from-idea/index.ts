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

    // 1. Get idea details
    const { data: idea, error: ideaError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, user_id, koc_id, voice_audio_url')
      .eq('id', ideaId)
      .single();

    if (ideaError || !idea) throw new Error(`Idea with ID ${ideaId} not found.`);
    if (!idea.voice_audio_url) throw new Error("Idea does not have a voice audio URL.");

    // 2. Get the next source video for the KOC sequentially
    const { data: sourceVideo, error: videoError } = await supabaseAdmin
      .rpc('get_and_update_next_source_video', { p_koc_id: idea.koc_id })
      .single();

    if (videoError || !sourceVideo) {
      throw new Error(`Không tìm thấy video nguồn nào cho KOC. Vui lòng tải lên ít nhất một video trong tab "Nguồn Video" của KOC.`);
    }
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_PUBLIC_URL) throw new Error("Missing R2_PUBLIC_URL config.");
    const sourceVideoUrl = `https://${R2_PUBLIC_URL}/${sourceVideo.r2_key}`;

    // 3. Call the centralized function to check credits and create the task
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('check_and_deduct_credit', {
        p_user_id: idea.user_id,
        p_koc_id: idea.koc_id,
        p_idea_id: idea.id,
        p_audio_url: idea.voice_audio_url,
        p_video_url: sourceVideoUrl,
      });

    if (rpcError) throw new Error(`Lỗi RPC: ${rpcError.message}`);
    
    const result = rpcData[0];
    if (!result.success) throw new Error(result.message);

    console.log(`Successfully created dreamface task ${result.new_task_id} for idea ${idea.id}.`);

    return new Response(JSON.stringify({ success: true, message: "Yêu cầu tạo video đã được gửi đi." }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Error in manual-create-video-from-idea:", error);
    if (ideaId) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Lỗi tạo video', error_message: error.message }).eq('id', ideaId);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});