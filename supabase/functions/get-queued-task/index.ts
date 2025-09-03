// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { extensionId } = await req.json();
    if (!extensionId) {
      throw new Error("Thiếu extensionId.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Tìm một task đang chờ được gán cho extension này
    const { data: task, error: findError } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("assigned_extension_id", extensionId)
      .eq("status", "queued")
      .order("execution_order", { ascending: true })
      .limit(1)
      .single();

    if (findError || !task) {
      // Không có task nào hoặc có lỗi, trả về rỗng
      return new Response(JSON.stringify({ task: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nếu tìm thấy task, ngay lập tức cập nhật trạng thái thành 'running' để khóa nó lại
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from("tasks")
      .update({ status: "running" })
      .eq("id", task.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Trả task đã được cập nhật về cho extension
    return new Response(JSON.stringify({ task: updatedTask }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});