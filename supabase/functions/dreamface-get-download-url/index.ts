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
    const body = await req.json();
    const { taskId, idpost, userId } = body;
    logPayload.request_payload = { original_request: body };

    if (!taskId || !idpost || !userId) {
      throw new Error("taskId, idpost, and userId are required.");
    }
    logPayload.dreamface_task_id = taskId;
    logPayload.user_id = userId;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").eq("user_id", userId).limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error(`Chưa có API Key Dreamface nào được cấu hình cho user ${userId}.`);
    const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

    logPayload.request_payload.credentials_used = creds;

    const params = new URLSearchParams({ ...creds, idPost: idpost });
    const downloadUrl = `${API_BASE_URL}/video-download?${params.toString()}`;
    
    logPayload.request_payload.final_url_sent = downloadUrl;

    const downloadRes = await fetch(downloadUrl);
    
    if (!downloadRes.ok) {
        const errorText = await downloadRes.text();
        throw new Error(`Dreamface API Error (video-download): Status ${downloadRes.status}. Response: ${errorText}`);
    }

    const downloadData = await downloadRes.json();
    logPayload.response_body = downloadData;
    logPayload.status_code = downloadRes.status;

    if (downloadData.success === true && typeof downloadData.data === 'string' && downloadData.data.startsWith('http')) {
      // **THE FIX IS HERE: Only update status to 'completed' AFTER getting the URL.**
      await supabaseAdmin.from('dreamface_tasks').update({ result_video_url: downloadData.data, status: 'completed' }).eq('id', taskId);
    } else if (downloadData.code === 1 || (downloadData.success === true && !downloadData.data)) {
      logPayload.status_code = 202;
      logPayload.error_message = "Task is still processing. API did not provide a video URL yet. Will retry.";
      console.log(`Task ${taskId} is still processing or API returned ambiguous success.`);
    } else {
      const errorMessage = `Download failed: ${downloadData.message || JSON.stringify(downloadData)}`;
      logPayload.error_message = errorMessage;
      logPayload.status_code = 400;
      await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: errorMessage }).eq('id', taskId);
    }
    
    return new Response(JSON.stringify({ success: true, data: downloadData }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[dreamface-get-download-url] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    if (logPayload.dreamface_task_id) {
        await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: `Function error: ${error.message}` }).eq('id', logPayload.dreamface_task_id);
    }
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert(logPayload);
  }
});