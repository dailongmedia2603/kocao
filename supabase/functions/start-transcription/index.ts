// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "http://36.50.54.74:8000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { videoName, userId } = await req.json();
    if (!videoName || !userId) {
      throw new Error("videoName and userId are required.");
    }

    // 1. Tạo hoặc cập nhật tác vụ, đánh dấu là 'processing'
    const { data: taskData, error: upsertError } = await supabaseAdmin
      .from('transcription_tasks')
      .upsert({
        user_id: userId,
        video_name: videoName,
        video_storage_path: `/uploads/${videoName}`,
        status: 'processing', // Đánh dấu đang xử lý
        error_message: null, // Xóa lỗi cũ nếu có
      }, { onConflict: 'video_name' })
      .select('id')
      .single();

    if (upsertError) throw upsertError;

    // 2. Gọi API để bắt đầu tách script nhưng KHÔNG chờ kết quả
    // Dùng fetch mà không có await để nó chạy trong nền
    fetch(`${API_BASE_URL}/api/v1/transcribe`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://kocao.vercel.app/",
      },
      body: JSON.stringify({
        video_filename: videoName,
        language: "vi",
        model_size: "medium",
      }),
    }).catch(console.error); // Bắt lỗi nếu việc gọi API thất bại ngay lập tức

    // 3. Trả về ngay lập tức cho client
    return new Response(JSON.stringify({ success: true, message: "Yêu cầu tách script đã được gửi đi." }), {
      status: 202, // 202 Accepted: Yêu cầu đã được chấp nhận nhưng chưa xử lý xong
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});