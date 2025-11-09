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
    const { job } = await req.json();
    if (!job) {
      throw new Error("Tên công việc (job) là bắt buộc.");
    }

    // Danh sách các công việc được phép kích hoạt để bảo mật
    const allowedJobs = [
      'auto-idea-to-voice',
      'auto-voice-to-video',
      'auto-link-final-video',
      'generate-idea-content' // Sửa lỗi: Thêm job tạo kịch bản vào danh sách cho phép
    ];

    if (!allowedJobs.includes(job)) {
      throw new Error(`Tên công việc không hợp lệ: ${job}`);
    }

    // Tạo một admin client để gọi các function được bảo vệ
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`Đang kích hoạt công việc: ${job}`);
    const { data, error } = await supabaseAdmin.functions.invoke(job, {
        // Gửi một body rỗng để đảm bảo header Content-Type được thiết lập
        body: {}
    });

    if (error) {
      throw new Error(`Lỗi khi gọi function '${job}': ${error.message}`);
    }

    console.log(`Kích hoạt thành công công việc: ${job}. Phản hồi:`, data);
    return new Response(JSON.stringify({ success: true, message: `Công việc '${job}' đã được kích hoạt thành công.`, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Lỗi trong cron-job-trigger:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});