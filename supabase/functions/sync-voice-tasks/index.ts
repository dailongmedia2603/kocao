// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to call the voice API proxy with improved error handling
const callVoiceApi = async (supabaseAdmin, { path, method, body = {}, userId }) => {
  const { data, error } = await supabaseAdmin.functions.invoke("voice-api-proxy", {
    body: { path, method, body, userId },
  });

  if (error) {
    // Try to get the specific error message from the response data if it exists
    const errorMessage = data?.error || error.message;
    throw new Error(errorMessage); // Throw a cleaner error message
  }

  if (data.success === false) {
    throw new Error(data.error || "API báo lỗi nhưng không có thông báo chi tiết.");
  }
  
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

    // **THE FIX IS HERE: Only fetch a small batch of tasks at a time**
    const { data: pendingTasks, error: fetchError } = await supabaseAdmin
      .from('voice_tasks')
      .select('id, user_id')
      .eq('status', 'doing')
      .order('created_at', { ascending: true }) // Process oldest tasks first
      .limit(10); // Limit to 10 tasks per run to avoid rate limiting

    if (fetchError) {
      throw new Error(`Error fetching pending tasks: ${fetchError.message}`);
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No pending tasks to sync." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingTasks.length} tasks to sync in this batch.`);

    let successCount = 0;
    let errorCount = 0;

    for (const task of pendingTasks) {
      try {
        const apiTaskDetails = await callVoiceApi(supabaseAdmin, {
          path: `v1/task/${task.id}`,
          method: "GET",
          userId: task.user_id,
        });
        
        if (apiTaskDetails && apiTaskDetails.data) {
          const { status, error_message, metadata } = apiTaskDetails.data;
          
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
        
        // Mark the task as failed in the database so it doesn't get picked up again
        const { error: updateError } = await supabaseAdmin
          .from('voice_tasks')
          .update({
            status: 'error',
            error_message: `Sync failed: ${syncError.message}`
          })
          .eq('id', task.id);
        
        if (updateError) {
          console.error(`Failed to mark task ${task.id} as failed:`, updateError.message);
        }
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