// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Xử lý CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { taskId, status } = await req.json();

    // Kiểm tra dữ liệu đầu vào
    if (!taskId || !status) {
      return new Response(JSON.stringify({ error: "Thiếu taskId hoặc status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Các trạng thái hợp lệ
    const validStatuses = ["running", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: `Trạng thái không hợp lệ: ${status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sử dụng service_role key để có quyền ghi vào database từ function
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Cập nhật trạng thái của tác vụ
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ status: status })
      .eq("id", taskId);

    if (error) {
      console.error("Lỗi cập nhật Supabase:", error);
      throw error;
    }

    return new Response(JSON.stringify({ message: "Cập nhật trạng thái thành công" }), {
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