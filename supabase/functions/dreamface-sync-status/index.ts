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
    // Lấy một API key bất kỳ trong hệ thống để dùng chung
    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_dreamface_api_keys").select("account_id, user_id_dreamface, token_id, client_id").limit(1).single();
    if (apiKeyError || !apiKeyData) {
      console.log("No Dreamface API key configured in the system. Skipping sync.");
      return new Response(JSON.stringify({ message: "No Dreamface API key configured." }), { status: 200, headers: corsHeaders });
    }
    const creds = { accountId: apiKeyData.account_id, userId: apiKeyData.user_id_dreamface, tokenId: apiKeyData.token_id, clientId: apiKeyData.client_id };

    // Lấy danh sách video từ API Dreamface
    const videoListRes = await fetch(`${API_BASE_URL}/video-list?${new URLSearchParams(creds).toString()}`);
    const videoListData = await videoListRes.json();
    if (!videoListRes.ok || !videoListData.success) {
      console.error(`Failed to fetch video list from Dreamface API.`);
      return new Response(JSON.stringify({ error: "Failed to fetch video list from Dreamface API." }), { status: 500, headers: corsHeaders });
    }
    const dreamfaceTasks = videoListData.data || [];

    // Lấy tất cả các tác vụ đang xử lý trong CSDL của chúng ta
    const { data: ourProcessingTasks, error: ourTasksError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('*')
      .eq('status', 'processing');
    
    if (ourTasksError) throw ourTasksError;
    if (!ourProcessingTasks || ourProcessingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No processing tasks to sync." }), { status: 200, headers: corsHeaders });
    }

    for (const task of ourProcessingTasks) {
      try {
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
            // Kích hoạt hàm lấy link tải về (fire-and-forget)
            supabaseAdmin.functions.invoke('dreamface-get-download-url', { body: { taskId: task.id, idpost: dfTask.id, userId: task.user_id } }).catch(console.error);
          }
        } else {
          // Nếu task đã tồn tại hơn 15 phút mà không xuất hiện trên API, đánh dấu là lỗi
          const taskAgeMinutes = (new Date() - new Date(task.created_at)) / 1000 / 60;
          if (taskAgeMinutes > 15) {
            await supabaseAdmin.from('dreamface_tasks').update({
              status: 'failed',
              error_message: 'Sync timeout: Task did not appear in the API list after 15 minutes.'
            }).eq('id', task.id);
          }
        }
      } catch (taskSyncError) {
        console.error(`Error syncing individual task ${task.id}:`, taskSyncError.message);
      }
    }
    return new Response(JSON.stringify({ success: true, message: "Sync completed." }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Critical error in dreamface-sync-status:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});