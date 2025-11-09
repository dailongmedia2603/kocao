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
      .select('id, user_id, new_content, koc_id')
      .eq('id', ideaId)
      .single();

    if (ideaError || !idea) throw new Error(`Idea with ID ${ideaId} not found.`);
    if (!idea.new_content) throw new Error("Idea does not have content to generate voice from.");

    // 2. Find the KOC and its default voice settings
    const { data: koc, error: kocError } = await supabaseAdmin
      .from('kocs')
      .select('default_cloned_voice_id, default_cloned_voice_name')
      .eq('id', idea.koc_id)
      .single();

    if (kocError || !koc) {
      throw new Error(`KOC with ID ${idea.koc_id} not found.`);
    }
    if (!koc.default_cloned_voice_id || !koc.default_cloned_voice_name) {
      throw new Error(`KOC này chưa được cấu hình giọng nói mặc định. Vui lòng vào Chỉnh sửa KOC để thiết lập.`);
    }

    // 3. Update idea status to 'Đang tạo voice'
    await supabaseAdmin.from('koc_content_ideas').update({ status: 'Đang tạo voice' }).eq('id', idea.id);

    // 4. Call the voice-api-proxy function
    const { data: voiceData, error: voiceError } = await supabaseAdmin.functions.invoke('voice-api-proxy', {
      body: {
        userId: idea.user_id,
        path: "v1m/task/text-to-speech",
        method: "POST",
        body: {
          text: idea.new_content,
          voice_name: `ManualVoice for Idea ${idea.id.substring(0, 8)}`,
          model: "speech-2.5-hd-preview",
          voice_setting: { voice_id: koc.default_cloned_voice_id },
          cloned_voice_name: koc.default_cloned_voice_name
        }
      }
    });

    if (voiceError || voiceData.error) throw new Error(voiceError?.message || voiceData.error);
    
    const taskId = voiceData.task_id;
    if (!taskId) throw new Error("API did not return a task_id.");

    // 5. Link the voice_task_id to the idea
    await supabaseAdmin.from('koc_content_ideas').update({ voice_task_id: taskId }).eq('id', idea.id);
    
    console.log(`Successfully sent voice generation request for idea ${idea.id} with Task ID: ${taskId}.`);
    
    return new Response(JSON.stringify({ success: true, message: "Yêu cầu tạo voice đã được gửi đi." }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Error in manual-create-voice-from-idea:", error);
    // Rollback status if something fails
    if (ideaId) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from('koc_content_ideas').update({ status: 'Lỗi tạo voice', error_message: error.message }).eq('id', ideaId);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});