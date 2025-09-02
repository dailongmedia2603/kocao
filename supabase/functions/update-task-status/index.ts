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

    // --- Bắt đầu Transaction ---
    const { data, error } = await supabaseAdmin.rpc('update_task_and_chain', {
      task_id: taskId,
      new_status: status,
      error_message: errorMessage,
      extracted_data: extractedData
    });

    if (error) {
      console.error("Lỗi khi thực thi RPC:", error);
      throw error;
    }
    // --- Kết thúc Transaction ---

    return new Response(JSON.stringify({ success: true, data: data }), {
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