// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Tìm các tác vụ đã hoàn thành nhưng thiếu URL video cuối cùng
    const { data: tasksToUpdate, error: fetchError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('id')
      .eq('status', 'completed')
      .is('result_video_url', null)
      .not('idpost', 'is', null)
      .limit(10); // Xử lý theo lô

    if (fetchError) {
      throw new Error(`Lỗi khi tìm tác vụ cần cập nhật: ${fetchError.message}`);
    }

    if (!tasksToUpdate || tasksToUpdate.length === 0) {
      return new Response(JSON.stringify({ message: "Không có tác vụ hoàn thành nào bị thiếu URL video." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Tìm thấy ${tasksToUpdate.length} tác vụ để lấy URL tải xuống.`);

    const promises = tasksToUpdate.map(task => 
      supabaseAdmin.functions.invoke('dreamface-get-download-url', {
        body: { taskId: task.id }
      })
    );

    const results = await Promise.allSettled(promises);

    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.error || result.value.data?.error) {
          console.error(`Lỗi khi gọi get-download-url cho tác vụ ${tasksToUpdate[index].id}:`, result.value.error || result.value.data?.error);
          errorCount++;
        } else {
          successCount++;
        }
      } else {
        console.error(`Không thể gọi get-download-url cho tác vụ ${tasksToUpdate[index].id}:`, result.reason);
        errorCount++;
      }
    });

    const summary = `Đồng bộ hoàn tất. Kích hoạt lấy URL thành công cho: ${successCount} tác vụ. Thất bại: ${errorCount} tác vụ.`;
    return new Response(JSON.stringify({ message: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Lỗi nghiêm trọng trong hàm sync-dreamface-videos:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});