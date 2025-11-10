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
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_PUBLIC_URL) throw new Error("Missing R2_PUBLIC_URL config.");

    // 1. Get idea details
    const { data: idea, error: ideaError } = await supabaseAdmin
      .from('koc_content_ideas')
      .select('id, user_id, koc_id, voice_audio_url')
      .eq('id', ideaId)
      .single();

    if (ideaError || !idea) throw new Error(`Idea with ID ${ideaId} not found.`);
    if (!idea.voice_audio_url) throw new Error("Idea does not have a voice audio URL.");

    // 2. Update status to 'Đang tạo video'
    await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đang tạo video' }).eq('id', idea.id);

    // 3. Get the next source video for the KOC sequentially
    const { data: sourceVideo, error: videoError } = await supabaseAdmin
      .rpc('get_and_update_next_source_video', { p_koc_id: idea.koc_id })
      .single();

    if (videoError || !sourceVideo) {
      throw new Error(`Không tìm thấy video nguồn nào cho KOC. Vui lòng tải lên ít nhất một video trong tab "Nguồn Video" của KOC.`);
    }
    const sourceVideoUrl = `${R2_PUBLIC_URL}/${sourceVideo.r2_key}`;

    // 4. Create a new dreamface_tasks entry
    const { data: newDreamfaceTask, error: insertError } = await supabaseAdmin
      .from('dreamface_tasks')
      .insert({
        user_id: idea.user_id,
        koc_id: idea.koc_id,
        title: `ManualVideo for Idea ${idea.id.substring(0, 8)}`,
        status: 'pending', // To be picked up by the queue processor
        original_video_url: sourceVideoUrl,
        original_audio_url: idea.voice_audio_url,
      })
      .select('id')
      .single();

    if (insertError) throw new Error(`Failed to create dreamface task: ${insertError.message}`);

    // 5. Link the dreamface_task_id to the idea
    await supabaseAdmin.from('koc_content_ideas').update({ dreamface_task_id: newDreamfaceTask.id }).eq('id', idea.id);

    console.log(`Successfully created dreamface task ${newDreamfaceTask.id} for idea ${idea.id}.`);

    return new Response(JSON.stringify({ success: true, message: "Yêu cầu tạo video đã được gửi đi." }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Error in manual-create-video-from-idea:", error);
    if (ideaId) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đã tạo voice', error_message: error.message }).eq('id', ideaId);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});