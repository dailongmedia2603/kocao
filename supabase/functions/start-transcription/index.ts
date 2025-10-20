// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "http://36.50.54.74:8000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("--- start-transcription function invoked ---");

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    console.log("Parsing request body...");
    const { videoName, userId } = await req.json();
    console.log(`Received request for video: ${videoName}, user: ${userId}`);

    if (!videoName || !userId) {
      throw new Error("videoName and userId are required.");
    }

    console.log(`Upserting task for video: ${videoName}`);
    const { data: taskData, error: upsertError } = await supabaseAdmin
      .from('transcription_tasks')
      .upsert({
        user_id: userId,
        video_name: videoName,
        video_storage_path: `/uploads/${videoName}`,
        status: 'processing',
      }, { onConflict: 'video_name' })
      .select()
      .single();

    if (upsertError) throw upsertError;
    console.log(`Task ${taskData.id} is now processing.`);

    const payload = {
      video_filename: videoName,
      language: "vi",
      model_size: "medium",
    };
    
    const apiLog = {
      apiUrl: `${API_BASE_URL}/api/v1/transcribe`,
      payload: payload,
      response: null,
    };

    try {
      console.log("Calling external transcription API with payload:", payload);
      const apiResponse = await fetch(apiLog.apiUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://kocao.vercel.app/",
        },
        body: JSON.stringify(payload),
      });
      console.log(`External API responded with status: ${apiResponse.status}`);

      const result = await apiResponse.json();
      apiLog.response = result;

      if (!apiResponse.ok) {
        throw new Error(result.detail || JSON.stringify(result));
      }

      console.log(`Transcription successful for task ${taskData.id}. Updating database.`);
      const scriptContent = typeof result === 'string' ? result : JSON.stringify(result);
      await supabaseAdmin.from('transcription_tasks').update({
        status: 'completed',
        script_content: scriptContent,
        api_response_log: apiLog,
        error_message: null
      }).eq('id', taskData.id);

      console.log("Database update successful.");
      return new Response(JSON.stringify({ success: true, message: "Transcription completed successfully." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (transcribeError) {
      console.error("Error during transcription API call:", transcribeError.message);
      apiLog.response = { error: transcribeError.message };
      await supabaseAdmin.from('transcription_tasks').update({
        status: 'failed',
        error_message: transcribeError.message,
        api_response_log: apiLog,
      }).eq('id', taskData.id);
      
      throw transcribeError;
    }

  } catch (err) {
    console.error("--- Top-level error in start-transcription ---:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});