// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { oldTaskId } = await req.json();
    if (!oldTaskId) throw new Error("oldTaskId is required.");

    // 1. Fetch original task data
    const { data: oldTask, error: oldTaskError } = await supabaseAdmin
      .from('voice_tasks')
      .select('user_id, voice_name, cloned_voice_id, cloned_voice_name')
      .eq('id', oldTaskId)
      .single();
    if (oldTaskError) throw new Error(`Failed to find original task: ${oldTaskError.message}`);
    const { user_id, voice_name, cloned_voice_id, cloned_voice_name } = oldTask;

    // 2. Fetch original request payload from logs
    const { data: logData, error: logError } = await supabaseAdmin
      .from('tts_logs')
      .select('request_payload')
      .eq('task_id', oldTaskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (logError) throw new Error(`Failed to find logs for task: ${logError.message}`);
    const originalPayload = logData.request_payload;

    // 3. Get API Key
    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .eq("user_id", user_id)
      .limit(1)
      .single();
    if (apiKeyError || !apiKeyData) throw new Error("Could not find a voice API key for the user.");
    const apiKey = apiKeyData.api_key;

    // 4. Call the external API to create a new task
    const { voice_name: _removed, ...apiBody } = originalPayload || {};
    const apiUrl = "https://gateway.vivoo.work/v1m/task/text-to-speech";
    const fetchOptions = {
      method: 'POST',
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(apiBody),
    };
    const apiResponse = await fetch(apiUrl, fetchOptions);
    const responseData = await apiResponse.json();
    if (!apiResponse.ok) {
      throw new Error(responseData.message || JSON.stringify(responseData));
    }
    const newTaskId = responseData?.task_id;
    if (!newTaskId) throw new Error("API did not return a new task_id.");

    // 5. Log the new request
    await supabaseAdmin.from("tts_logs").insert({ 
        user_id: user_id, 
        task_id: newTaskId, 
        request_payload: originalPayload, 
        response_body: responseData, 
        status_code: apiResponse.status 
    });

    // 6. Replace old task with new task in DB
    const { error: deleteError } = await supabaseAdmin.from('voice_tasks').delete().eq('id', oldTaskId);
    if (deleteError) console.error(`Failed to delete old task ${oldTaskId}, continuing anyway...`, deleteError);

    const { error: insertError } = await supabaseAdmin.from("voice_tasks").insert({ 
      id: newTaskId,
      user_id: user_id, 
      voice_name: voice_name, 
      status: 'doing', 
      task_type: 'minimax_tts',
      cloned_voice_id: cloned_voice_id,
      cloned_voice_name: cloned_voice_name
    });
    if (insertError) throw new Error(`Failed to insert new task record: ${insertError.message}`);

    return new Response(JSON.stringify({ success: true, newTaskId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});