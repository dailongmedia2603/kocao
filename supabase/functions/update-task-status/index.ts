// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Xử lý yêu cầu CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Phân tích nội dung yêu cầu
    const { taskId, status, errorMessage } = await req.json();

    // 2. Kiểm tra dữ liệu đầu vào
    if (!taskId || !status) {
      return new Response(JSON.stringify({ error: "Thiếu taskId hoặc status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Tạo Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Chuẩn bị dữ liệu để cập nhật
    const updatePayload = { status };
    // Nếu trạng thái là 'failed', ghi lại log lỗi
    if (status === 'failed' && errorMessage) {
      updatePayload.error_log = errorMessage;
    } else if (status !== 'failed') {
      // Xóa log lỗi cũ nếu trạng thái không phải là 'failed'
      updatePayload.error_log = null;
    }

    // 5. Thực hiện cập nhật trực tiếp vào bảng 'tasks'
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select()
      .single();

    // 6. Xử lý lỗi từ cơ sở dữ liệu
    if (error) {
      console.error("Lỗi cập nhật Supabase:", error);
      throw error;
    }

    // 7. Trả về phản hồi thành công
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // 8. Xử lý các lỗi chung khác
    console.error("Lỗi trong Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});