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

    // 1. Tạo hoặc cập nhật tác vụ trong DB, đánh dấu là 'processing'
    const { data: taskData, error: upsertError } = await supabaseAdmin
      .from('transcription_tasks')
      .upsert({
        user_id: userId,
        video_name: videoName,
        video_storage_path: `/uploads/${videoName}`,
        status: 'processing',
      }, { onConflict: 'video_name' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    // 2. Chuẩn bị payload và log
    const payload = {
      video_filename: videoName,
      language: "vi",
      model_size: "medium",
    };
    const apiLog = {
      apiUrl: `${API_BASE_URL}/api/v1/transcribe`,
      payload: payload,
      response: null,
    };

    try {
      // 3. Gọi API tách script
      const apiResponse = await fetch(`${API_BASE_URL}/api/v1/transcribe`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://kocao.vercel.app/",
        },
        body: JSON.stringify(payload),
      });

      const result = await apiResponse.json();
      apiLog.response = result;

      if (!apiResponse.ok) {
        throw new Error(result.detail || JSON.stringify(result));
      }

      // 4. Cập nhật kết quả vào DB khi thành công
      const scriptContent = typeof result === 'string' ? result : JSON.stringify(result);
      await supabaseAdmin.from('transcription_tasks').update({
        status: 'completed',
        script_content: scriptContent,
        api_response_log: apiLog,
        error_message: null
      }).eq('id', taskData.id);

      return new Response(JSON.stringify({ success: true, message: "Transcription completed successfully." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (transcribeError) {
      // 5. Cập nhật lỗi vào DB nếu thất bại
      apiLog.response = { error: transcribeError.message };
      await supabaseAdmin.from('transcription_tasks').update({
        status: 'failed',
        error_message: transcribeError.message,
        api_response_log: apiLog,
      }).eq('id', taskData.id);
      
      // Ném lỗi để client nhận biết
      throw transcribeError;
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});