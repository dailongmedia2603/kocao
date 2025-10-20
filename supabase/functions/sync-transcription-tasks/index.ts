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

    // 2. Lấy danh sách các bản ghi đã hoàn thành từ API server
    const listResponse = await fetch(`${API_BASE_URL}/api/v1/transcriptions/list`);
    if (!listResponse.ok) throw new Error("Failed to fetch transcription list from API.");
    
    const listData = await listResponse.json();
    
    // Xử lý an toàn các kiểu dữ liệu trả về khác nhau
    const completedFiles = Array.isArray(listData) 
      ? listData 
      : (listData && Array.isArray(listData.videos)) 
          ? listData.videos 
          : [];

    const completedFileNames = new Set(completedFiles.map((f: any) => f.filename));

    for (const task of processingTasks) {
      // 3. Nếu video đã có trong danh sách hoàn thành
      if (completedFileNames.has(task.video_name)) {
        try {
          console.log(`Task for ${task.video_name} is completed. Fetching content...`);
          // 4. Tải nội dung script
          const scriptResponse = await fetch(`${API_BASE_URL}/api/v1/transcription/${task.video_name}`);
          if (!scriptResponse.ok) throw new Error(`Failed to fetch script for ${task.video_name}`);
          
          const scriptResult = await scriptResponse.json();
          const scriptContent = scriptResult.text || JSON.stringify(scriptResult);

          // 5. Cập nhật vào DB
          await supabaseAdmin
            .from('transcription_tasks')
            .update({ status: 'completed', script_content: scriptContent, error_message: null })
            .eq('id', task.id);
          
          console.log(`Synced task for ${task.video_name} successfully.`);
        } catch (e) {
          console.error(`Error syncing individual task ${task.video_name}:`, e.message);
          await supabaseAdmin
            .from('transcription_tasks')
            .update({ status: 'failed', error_message: `Sync failed: ${e.message}` })
            .eq('id', task.id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Sync completed." }), { headers: corsHeaders });
  } catch (error) {
    console.error("Error in sync-transcription-tasks:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});