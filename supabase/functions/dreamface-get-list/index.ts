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
  const logPayload = { user_id: null, action: 'get-list', request_payload: null, response_body: null, status_code: 200, error_message: null };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");
    logPayload.user_id = user.id;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").eq("user_id", user.id).limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error("Chưa có API Key Dreamface nào được cấu hình.");
    const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

    const videoListRes = await fetch(`${API_BASE_URL}/video-list?${new URLSearchParams(creds).toString()}`);
    const videoListData = await videoListRes.json();
    logPayload.response_body = videoListData;
    if (!videoListRes.ok) {
      const errorText = await videoListRes.text();
      throw new Error(`Dreamface API Error (get-video-list): Status ${videoListRes.status}. Response: ${errorText}`);
    }
    
    const dreamfaceTasks = videoListData?.data;
    if (videoListData.success && Array.isArray(dreamfaceTasks)) {
      const { data: ourTasks, error: ourTasksError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('user_id', user.id);
      if (ourTasksError) throw ourTasksError;

      const dreamfaceTaskAnimateIds = new Set(dreamfaceTasks.map(dft => dft.animate_id));

      for (const task of ourTasks) {
        const dfTask = dreamfaceTasks.find(dft => dft.animate_id === task.animate_id);
        
        if (task.status === 'processing' && !dfTask) {
          await supabaseAdmin.from('dreamface_tasks').update({
            status: 'failed',
            error_message: 'Sync failed: Task not found in recent API list. It may be completed or errored.'
          }).eq('id', task.id);
          continue;
        }

        if (!dfTask) continue;

        let taskAfterUpdate = task;
        const updatePayload = {};

        if (dfTask.web_work_status < 0 && task.status !== 'failed') {
          updatePayload.status = 'failed';
          updatePayload.error_message = `External API reported error status: ${dfTask.web_work_status}`;
        } else if (dfTask.web_work_status === 200 && task.status !== 'completed') {
          updatePayload.status = 'completed';
        }
        if (dfTask.id && !task.idpost) updatePayload.idpost = dfTask.id;
        if (dfTask.work_webp_path && !task.thumbnail_url) updatePayload.thumbnail_url = dfTask.work_webp_path;

        if (Object.keys(updatePayload).length > 0) {
          const { data, error } = await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', task.id).select().single();
          if (error) {
            console.error(`Failed to update task ${task.id}:`, error.message);
          } else {
            taskAfterUpdate = data;
          }
        }

        // **THE FIX IS HERE: Only call get-download-url when the status is 200**
        if (dfTask.web_work_status === 200 && taskAfterUpdate.idpost && !taskAfterUpdate.result_video_url) {
          supabaseAdmin.functions.invoke('dreamface-get-download-url', {
            body: JSON.stringify({ 
              taskId: taskAfterUpdate.id,
              idpost: taskAfterUpdate.idpost,
              userId: taskAfterUpdate.user_id
            })
          }).catch(err => console.error(`Error invoking get-download-url for task ${taskAfterUpdate.id}:`, err.message));
        }
      }
    }

    const { data: allTasks, error: allTasksError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (allTasksError) throw allTasksError;
    
    return new Response(JSON.stringify({ success: true, data: allTasks }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[dreamface-get-list] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert(logPayload);
  }
});