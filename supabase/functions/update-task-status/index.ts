// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { taskId, status, errorMessage, extractedData } = await req.json();

    if (!taskId || !status) {
      return new Response(JSON.stringify({ error: "Thiếu taskId hoặc status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Bước 1: Cập nhật trạng thái tác vụ và lấy thông tin cần thiết
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from("tasks")
      .update({
        status: status,
        error_log: status === 'failed' ? errorMessage : null,
      })
      .eq("id", taskId)
      .select("user_id, project_id")
      .single();

    if (updateError) {
      console.error("Lỗi cập nhật tác vụ:", updateError);
      throw updateError;
    }

    // Bước 2: Nếu tác vụ trích xuất thành công, lưu tệp vào thư viện
    if (status === 'completed' && extractedData?.url && extractedData?.fileName) {
      const { error: insertError } = await supabaseAdmin
        .from("user_files")
        .insert({
          user_id: updatedTask.user_id,
          project_id: updatedTask.project_id,
          file_name: extractedData.fileName,
          file_url: extractedData.url,
          storage_path: 'extracted',
          source: 'extract',
        });

      if (insertError) {
        // Ghi lại lỗi nhưng không làm hỏng toàn bộ function,
        // vì việc chính là cập nhật trạng thái đã thành công.
        console.error("Lỗi lưu tệp đã trích xuất:", insertError);
      }
    }

    // Bước 3: Trả về thông báo thành công đơn giản (cơ chế "fire-and-forget")
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});