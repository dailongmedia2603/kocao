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

  try {
    const { data: usersWithProcessingTasks, error: userError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('user_id')
      .eq('status', 'processing')
      .limit(100);
    
    if (userError) throw userError;
    if (!usersWithProcessingTasks || usersWithProcessingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No users with processing tasks." }), { status: 200, headers: corsHeaders });
    }

    const uniqueUserIds = [...new Set(usersWithProcessingTasks.map(t => t.user_id))];

    for (const userId of uniqueUserIds) {
      try {
        const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").eq("user_id", userId).limit(1).single();
        if (apiKeyError) {
          console.error(`No API key for user ${userId}, skipping their tasks.`);
          continue;
        }
        const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

        const videoListRes = await fetch(`${API_BASE_URL}/video-list?${new URLSearchParams(creds).toString()}`);
        const videoListData = await videoListRes.json();
        if (!videoListRes.ok || !videoListData.success) {
          console.error(`Failed to fetch video list for user ${userId}.`);
          continue;
        }
        const dreamfaceTasks = videoListData.data || [];

        const { data: ourProcessingTasks, error: ourTasksError } = await supabaseAdmin
          .from('dreamface_tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'processing');
        
        if (ourTasksError) throw ourTasksError;

        for (const task of ourProcessingTasks) {
          const dfTask = dreamfaceTasks.find(dft => dft.animate_id === task.animate_id);

          if (dfTask) {
            const updatePayload = {};
            if (dfTask.web_work_status < 0 && task.status !== 'failed') {
              updatePayload.status = 'failed';
              updatePayload.error_message = `API reported error status: ${dfTask.web_work_status}`;
            }
            if (dfTask.id && !task.idpost) updatePayload.idpost = dfTask.id;
            if (dfTask.work_webp_path && !task.thumbnail_url) updatePayload.thumbnail_url = dfTask.work_webp_path;

            if (Object.keys(updatePayload).length > 0) {
              await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', task.id);
            }

            if (dfTask.web_work_status === 200 && dfTask.id && !task.result_video_url) {
              supabaseAdmin.functions.invoke('dreamface-get-download-url', { body: { taskId: task.id, idpost: dfTask.id, userId: task.user_id } }).catch(console.error);
            }
          } else {
            const taskAgeMinutes = (new Date() - new Date(task.created_at)) / 1000 / 60;
            if (taskAgeMinutes > 15) {
              await supabaseAdmin.from('dreamface_tasks').update({
                status: 'failed',
                error_message: 'Sync timeout: Task did not appear in the API list after 15 minutes.'
              }).eq('id', task.id);
            }
          }
        }
      } catch (userSyncError) {
        console.error(`Error syncing tasks for user ${userId}:`, userSyncError.message);
      }
    }
    return new Response(JSON.stringify({ success: true, message: "Sync completed." }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Critical error in dreamface-sync-status:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});