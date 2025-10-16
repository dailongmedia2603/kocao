// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "https://dapi.qcv.vn";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const logPayload = { user_id: null, action: 'get-download-url', request_payload: null, response_body: null, status_code: 200, error_message: null };

  try {
    // This function is invoked internally, so we don't need to check auth headers.
    // The user_id will be derived from the task itself.
    const { taskId } = await req.json();
    logPayload.request_payload = { taskId };
    if (!taskId) throw new Error("Task ID is required.");
    logPayload.dreamface_task_id = taskId;

    const { data: task, error: taskError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('id', taskId).single();
    if (taskError || !task) throw new Error(`Task not found for ID: ${taskId}`);
    if (!task.idpost) throw new Error(`Task ${taskId} is not ready for download (missing idpost).`);
    
    logPayload.user_id = task.user_id;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").eq("user_id", task.user_id).limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error(`Chưa có API Key Dreamface nào được cấu hình cho user ${task.user_id}.`);
    const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

    const params = new URLSearchParams({ ...creds, idPost: task.idpost });
    const downloadUrl = `${API_BASE_URL}/video-download?${params.toString()}`;
    const downloadRes = await fetch(downloadUrl);
    const downloadData = await downloadRes.json();
    logPayload.response_body = downloadData;

    if (downloadData.code === 0 && downloadData.data.videoUrl) {
      await supabaseAdmin.from('dreamface_tasks').update({ result_video_url: downloadData.data.videoUrl, status: 'completed' }).eq('id', task.id);
    } else if (downloadData.code !== 1) { // code: 1 means still processing, do nothing
      const errorMessage = `Download failed: ${downloadData.message || 'Unknown error'}`;
      await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: errorMessage }).eq('id', task.id);
    }
    
    return new Response(JSON.stringify({ success: true, data: downloadData }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[dreamface-get-download-url] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    // Also log to DB if possible
    if (logPayload.dreamface_task_id) {
        await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: `Function error: ${error.message}` }).eq('id', logPayload.dreamface_task_id);
    }
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert(logPayload);
  }
});