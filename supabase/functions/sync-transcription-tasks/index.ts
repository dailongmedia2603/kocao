// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "http://36.50.54.74:8000";

serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Lấy danh sách các tác vụ đang xử lý
    const { data: processingTasks, error: fetchError } = await supabaseAdmin
      .from('transcription_tasks')
      .select('id, video_name')
      .eq('status', 'processing');

    if (fetchError) throw fetchError;
    if (!processingTasks || processingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks to sync." }), { headers: corsHeaders });
    }

    console.log(`Found ${processingTasks.length} tasks to sync.`);

    for (const task of processingTasks) {
      try {
        // 2. Với mỗi task, gọi trực tiếp API để kiểm tra trạng thái
        console.log(`Checking status for ${task.video_name}...`);
        const statusResponse = await fetch(`${API_BASE_URL}/api/v1/transcription/status/${task.video_name}`);
        
        if (!statusResponse.ok) {
            // Nếu API trả về lỗi (ví dụ: 404 Not Found), có thể tác vụ chưa bắt đầu hoặc đã lỗi
            console.log(`Status check for ${task.video_name} failed with status ${statusResponse.status}. Assuming it's still processing.`);
            continue; // Bỏ qua và kiểm tra lại ở lần chạy sau
        }

        const statusData = await statusResponse.json();
        console.log(`Status for ${task.video_name} is: ${statusData.status}`);

        // 3. Nếu trạng thái là 'completed', lấy kết quả
        if (statusData.status === 'completed') {
          console.log(`Fetching content for completed task ${task.video_name}...`);
          const scriptResponse = await fetch(`${API_BASE_URL}/api/v1/transcription/${task.video_name}`);
          if (!scriptResponse.ok) throw new Error(`Failed to fetch script for ${task.video_name}`);
          
          const scriptResult = await scriptResponse.json();
          const scriptContent = scriptResult.text || JSON.stringify(scriptResult);

          // 4. Cập nhật vào DB
          await supabaseAdmin
            .from('transcription_tasks')
            .update({ status: 'completed', script_content: scriptContent, error_message: null })
            .eq('id', task.id);
          
          console.log(`Synced task for ${task.video_name} successfully.`);
        } else if (statusData.status === 'failed') {
            await supabaseAdmin
            .from('transcription_tasks')
            .update({ status: 'failed', error_message: statusData.message || 'Transcription failed on API server.' })
            .eq('id', task.id);
            console.log(`Task ${task.video_name} failed on API server.`);
        }
        // Nếu status vẫn là 'processing', không làm gì cả, chờ lần chạy sau.

      } catch (e) {
        console.error(`Error syncing individual task ${task.video_name}:`, e.message);
        // Không cập nhật lỗi ở đây để tránh ghi đè lỗi từ API
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Sync completed." }), { headers: corsHeaders });
  } catch (error) {
    console.error("Error in sync-transcription-tasks:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});