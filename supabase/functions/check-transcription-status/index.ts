// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SpeechClient } from "npm:@google-cloud/speech@^6.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (_req) => {
  if (_req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tasks, error: fetchError } = await supabaseAdmin
      .from('transcription_tasks')
      .select('id, google_operation_name')
      .eq('status', 'processing');

    if (fetchError) throw new Error(`Failed to fetch processing tasks: ${fetchError.message}`);
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks to check." }), { headers: corsHeaders });
    }

    const credentials = JSON.parse(Deno.env.get("GOOGLE_CREDENTIALS_JSON")!);
    const speech = new SpeechClient({ credentials });

    for (const task of tasks) {
      try {
        if (!task.google_operation_name) {
            console.warn(`Task ${task.id} is processing but has no operation name. Skipping.`);
            continue;
        }
        const [operation] = await speech.checkLongRunningRecognizeProgress(task.google_operation_name);
        
        if (operation.done) {
          if (operation.error) {
            throw new Error(operation.error.message);
          }
          
          // The operation is done, but the result might be in the operation object itself
          // or you might need to call the original method again with the operation name.
          // For Speech-to-Text, the result is typically embedded in the 'response' field of the completed operation.
          const response = operation.response;
          const transcription = response.results
            ?.map(result => result.alternatives?.[0].transcript)
            .join('\n');

          await supabaseAdmin
            .from('transcription_tasks')
            .update({ status: 'completed', script_content: transcription })
            .eq('id', task.id);

        }
      } catch (error) {
        console.error(`Failed to check task ${task.id}:`, error.message);
        await supabaseAdmin
          .from('transcription_tasks')
          .update({ status: 'failed', error_message: error.message })
          .eq('id', task.id);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Checked ${tasks.length} tasks.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in check-transcription-status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});