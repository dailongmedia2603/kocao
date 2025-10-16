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
  const params = new URLSearchParams({ ...creds, id: task.idPost });
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

    const { data: processingTasks, error: processingError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('user_id', user.id).eq('status', 'processing');
    if (processingError) throw processingError;

    if (processingTasks.length > 0) {
      const videoListRes = await fetch(`${API_BASE_URL}/video-list?${new URLSearchParams(creds).toString()}`);
      const videoListData = await videoListRes.json();
      logPayload.response_body = videoListData;
      if (!videoListRes.ok) {
        const errorText = await videoListRes.text();
        throw new Error(`Dreamface API Error (get-video-list): Status ${videoListRes.status}. Response: ${errorText}`);
      }
      
      const dreamfaceTasks = videoListData?.data;
      if (!videoListData.success || !Array.isArray(dreamfaceTasks)) {
        console.error("Không tìm thấy danh sách video hợp lệ trong phản hồi /video-list. Phản hồi:", JSON.stringify(videoListData));
      } else {
        for (const task of processingTasks) {
          const dfTask = dreamfaceTasks.find(dft => dft.animate_id === task.animate_id);
          if (dfTask) {
            const updatePayload = {};
            if (dfTask.work_webp_path && !task.thumbnail_url) updatePayload.thumbnail_url = dfTask.work_webp_path;
            if (dfTask.id && !task.idPost) updatePayload.idPost = dfTask.id;
            if (dfTask.status === 'error' || dfTask.status === 'nsfw') {
              updatePayload.status = 'failed';
              updatePayload.error_message = dfTask.error_message || `External API reported status: ${dfTask.status}`;
            }
            if (Object.keys(updatePayload).length > 0) {
              await supabaseAdmin.from('dreamface_tasks').update(updatePayload).eq('id', task.id);
            }
            if (dfTask.id) {
              await fetchAndUpdateVideoUrl(supabaseAdmin, creds, { ...task, ...updatePayload });
            }
          }
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