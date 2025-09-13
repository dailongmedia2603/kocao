// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to call the voice API proxy
const callVoiceApi = async (supabaseAdmin, path, method, body = {}) => {
  const { data, error } = await supabaseAdmin.functions.invoke("voice-api-proxy", {
    body: { path, method, body },
  });
  if (error) throw new Error(`Edge Function invoke error: ${error.message}`);
  if (data.error) throw new Error(`API Error: ${data.error}`);
  return data;
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

    // 1. Find all tasks in our DB that are currently 'doing'
    const { data: pendingTasks, error: fetchError } = await supabaseAdmin
      .from('voice_tasks')
      .select('id')
      .eq('status', 'doing');

    if (fetchError) {
      throw new Error(`Error fetching pending tasks: ${fetchError.message}`);
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No pending tasks to sync." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingTasks.length} tasks to sync.`);

    let successCount = 0;
    let errorCount = 0;

    // 2. For each task, check its status from the external API
    for (const task of pendingTasks) {
      try {
        const apiTaskDetails = await callVoiceApi(supabaseAdmin, `v1/task/${task.id}`, "GET");
        
        if (apiTaskDetails && apiTaskDetails.data) {
          const { status, error_message, metadata } = apiTaskDetails.data;
          
          // 3. If the status has changed, update our DB
          if (status !== 'doing') {
            const updatePayload = {
              status: status,
              error_message: error_message || null,
              audio_url: metadata?.audio_url || null,
              srt_url: metadata?.srt_url || null,
              credit_cost: metadata?.credit_cost || null,
            };

            const { error: updateError } = await supabaseAdmin
              .from('voice_tasks')
              .update(updatePayload)
              .eq('id', task.id);

            if (updateError) {
              console.error(`Failed to update task ${task.id} in DB:`, updateError.message);
              errorCount++;
            } else {
              console.log(`Synced task ${task.id} to status: ${status}`);
              successCount++;
            }
          }
        }
      } catch (syncError) {
        console.error(`Error syncing task ${task.id}:`, syncError.message);
        errorCount++;
      }
    }

    const summary = `Sync complete. Successfully updated: ${successCount}. Failed: ${errorCount}.`;
    return new Response(JSON.stringify({ message: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Critical error in sync-voice-tasks function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});