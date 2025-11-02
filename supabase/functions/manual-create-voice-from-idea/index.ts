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
    const { ideaId } = await req.json();
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

    // 2. Find a campaign for the KOC to get voice settings
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('automation_campaigns')
      .select('cloned_voice_id, cloned_voice_name')
      .eq('koc_id', idea.koc_id)
      .limit(1)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`No campaign configured for KOC ${idea.koc_id}. Cannot determine which voice to use.`);
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
          voice_setting: { voice_id: campaign.cloned_voice_id },
          cloned_voice_name: campaign.cloned_voice_name
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
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});