// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "https://dapi.qcv.vn";

// Helper to fetch and update final video URL
const fetchAndUpdateVideoUrl = async (supabaseAdmin, creds, task) => {
  if (!task.idPost) return;
  // THE FIX IS HERE: Change parameter name from 'id' to 'idPost'
  const params = new URLSearchParams({ ...creds, idPost: task.idPost });
  const downloadUrl = `${API_BASE_URL}/video-download?${params.toString()}`;
  const downloadRes = await fetch(downloadUrl);
  const downloadData = await downloadRes.json();
  if (downloadData.code === 0 && downloadData.data.videoUrl) {
    await supabaseAdmin.from('dreamface_tasks').update({ result_video_url: downloadData.data.videoUrl, status: 'completed' }).eq('id', task.id);
  } else if (downloadData.code !== 1) {
    await supabaseAdmin.from('dreamface_tasks').update({ status: 'failed', error_message: `Download failed: ${downloadData.message || 'Unknown error'}` }).eq('id', task.id);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const logPayload = { user_id: null, action: 'get-download-url', request_payload: null, response_body: null, status_code: 200, error_message: null };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");
    logPayload.user_id = user.id;

    const { taskId } = await req.json();
    logPayload.request_payload = { taskId };
    if (!taskId) throw new Error("Task ID is required.");
    logPayload.dreamface_task_id = taskId;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").eq("user_id", user.id).limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error("Chưa có API Key Dreamface nào được cấu hình.");
    const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

    const { data: task, error: taskError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('id', taskId).single();
    if (taskError || !task) throw new Error("Task not found.");

    await fetchAndUpdateVideoUrl(supabaseAdmin, creds, task);

    const { data: updatedTask } = await supabaseAdmin.from('dreamface_tasks').select('result_video_url').eq('id', taskId).single();
    
    logPayload.response_body = updatedTask;
    return new Response(JSON.stringify({ success: true, data: updatedTask }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[dreamface-get-download-url] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert(logPayload);
  }
});