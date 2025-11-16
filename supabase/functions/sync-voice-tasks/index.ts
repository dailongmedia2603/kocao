// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { data: pendingTasks, error: fetchError } = await supabaseAdmin
      .from('voice_tasks')
      .select('id, user_id')
      .eq('status', 'doing')
      .order('created_at', { ascending: true })
      .limit(5);

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

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .limit(1)
      .single();
      
    if (apiKeyError || !apiKeyData) {
      throw new Error("Chưa có bất kỳ API Key Voice nào được cấu hình trong toàn bộ hệ thống.");
    }
    const apiKey = apiKeyData.api_key;

    let successCount = 0;
    let errorCount = 0;

    for (const task of pendingTasks) {
      try {
        const apiUrl = `https://gateway.vivoo.work/v1m/task/${task.id}`;
        const apiResponse = await fetch(apiUrl, {
          method: "GET",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        });

        // SỬA LỖI: Xử lý trường hợp 404 Not Found
        if (apiResponse.status === 404) {
          console.warn(`Task ${task.id} returned 404. It might be completed and purged. Skipping for now.`);
          // Bỏ qua task này trong lần chạy này, không báo lỗi
          continue;
        }

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`API Error (${apiResponse.status}): ${errorText}`);
        }
        
        const apiTaskDetails = await apiResponse.json();
        const taskData = apiTaskDetails.data || apiTaskDetails;

        if (taskData && taskData.status) {
          const { status, error_message, metadata } = taskData;
          
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
        } else {
          throw new Error("API returned an empty or invalid data object for this task.");
        }
      } catch (syncError) {
        console.error(`Error syncing task ${task.id}:`, syncError.message);
        errorCount++;
        
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