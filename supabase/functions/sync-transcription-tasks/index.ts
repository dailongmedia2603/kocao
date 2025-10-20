// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "http://36.50.54.74:8000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: processingTasks, error: fetchError } = await supabaseAdmin
      .from('transcription_tasks')
      .select('id, video_name')
      .eq('status', 'processing');

    if (fetchError) {
      throw new Error(`Error fetching processing tasks: ${fetchError.message}`);
    }

    if (!processingTasks || processingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks are currently processing." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${processingTasks.length} tasks to sync.`);
    let successCount = 0;
    let errorCount = 0;

    for (const task of processingTasks) {
      try {
        const videoNameWithoutExt = task.video_name.replace('.mp4', '');
        const apiUrl = `${API_BASE_URL}/api/v1/transcription/${videoNameWithoutExt}`;
        
        const apiResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: { "Origin": "https://kocao.vercel.app" }
        });

        if (apiResponse.status === 404) {
          console.log(`Task ${task.id} (${task.video_name}) is not ready yet. Skipping.`);
          continue;
        }

        const scriptContent = await apiResponse.text();

        if (!apiResponse.ok) {
          throw new Error(`API Error (${apiResponse.status}): ${scriptContent}`);
        }

        const { error: updateError } = await supabaseAdmin
          .from('transcription_tasks')
          .update({
            status: 'completed',
            script_content: scriptContent,
            error_message: null,
          })
          .eq('id', task.id);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }
        
        successCount++;
        console.log(`Successfully synced task ${task.id}.`);

      } catch (syncError) {
        console.error(`Error syncing task ${task.id}:`, syncError.message);
        await supabaseAdmin
          .from('transcription_tasks')
          .update({ status: 'failed', error_message: syncError.message })
          .eq('id', task.id);
        errorCount++;
      }
    }

    const summary = `Sync complete. Success: ${successCount}, Failed: ${errorCount}, Skipped: ${processingTasks.length - successCount - errorCount}.`;
    return new Response(JSON.stringify({ message: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Critical error in sync-transcription-tasks function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});