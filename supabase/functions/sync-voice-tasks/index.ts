// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function được nâng cấp để hiểu định dạng trả về mới
const callVoiceApi = async (supabaseAdmin, { path, method, body = {}, userId }) => {
  const { data, error } = await supabaseAdmin.functions.invoke("voice-api-proxy", {
    body: { path, method, body, userId },
  });

  if (error) {
    // Lỗi này chỉ xảy ra nếu function bị sập hoàn toàn, rất hiếm
    throw new Error(`Lỗi gọi function: ${error.message}`);
  }

  // Kiểm tra cờ success trong nội dung trả về
  if (data.success === false) {
    throw new Error(data.error || "API báo lỗi nhưng không có thông báo chi tiết.");
  }
  
  return data;
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

    const { data: pendingTasks, error: fetchError } = await supabaseAdmin
      .from('voice_tasks')
      .select('id, user_id')
      .eq('status', 'doing');

    if (fetchError) {
      throw new Error(`Lỗi lấy task đang xử lý: ${fetchError.message}`);
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      return new Response(JSON.stringify({ message: "Không có task nào đang xử lý để đồng bộ." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const task of pendingTasks) {
      try {
        const apiTaskDetails = await callVoiceApi(supabaseAdmin, {
          path: `v1/task/${task.id}`,
          method: "GET",
          userId: task.user_id,
        });
        
        if (apiTaskDetails && apiTaskDetails.data) {
          const { status, error_message, metadata } = apiTaskDetails.data;
          
          if (status !== 'doing') {
            const updatePayload = {
              status: status,
              error_message: error_message || null,
              audio_url: metadata?.audio_url || null,
              srt_url: metadata?.srt_url || null,
              credit_cost: metadata?.credit_cost || null,
            };

            const { error: updateError } = await supabaseAdmin
              .from('voice_tasks')
              .update(updatePayload)
              .eq('id', task.id);

            if (updateError) {
              console.error(`Lỗi cập nhật task ${task.id} trong DB:`, updateError.message);
              errorCount++;
            } else {
              successCount++;
            }
          }
        }
      } catch (syncError) {
        console.error(`Lỗi đồng bộ task ${task.id}:`, syncError.message);
        errorCount++;
        
        // Cập nhật trạng thái lỗi và ghi lại thông báo lỗi chi tiết
        await supabaseAdmin
          .from('voice_tasks')
          .update({
            status: 'error',
            error_message: `Lỗi đồng bộ: ${syncError.message}`
          })
          .eq('id', task.id);
      }
    }

    const summary = `Đồng bộ hoàn tất. Cập nhật thành công: ${successCount}. Thất bại: ${errorCount}.`;
    return new Response(JSON.stringify({ message: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Trả về 200 để cron job không báo lỗi
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});