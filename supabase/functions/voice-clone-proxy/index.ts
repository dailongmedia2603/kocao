// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let logPayload = { user_id: null, request_url: "https://gateway.vivoo.work/v1m/voice/clone", request_payload: {}, response_body: null, status_code: null, status_text: null };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Thiếu thông tin xác thực.");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Người dùng không hợp lệ.");
    logPayload.user_id = user.id;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_voice_api_keys").select("api_key").limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error("Chưa có API Key Voice nào được cấu hình trong hệ thống.");
    const apiKey = apiKeyData.api_key;
    
    const { voice_name, preview_text, sample_id } = await req.json();
    if (!voice_name || !preview_text || !sample_id) {
      throw new Error("Thiếu tên giọng nói, văn bản xem trước, hoặc ID của file mẫu.");
    }
    logPayload.request_payload = { voice_name, preview_text, sample_id };

    // Get the public URL from the database using the sample_id
    const { data: sampleData, error: sampleError } = await supabaseAdmin
      .from('voice_clone_samples')
      .select('public_url')
      .eq('id', sample_id)
      .eq('user_id', user.id) // Security check
      .single();

    if (sampleError || !sampleData) {
      throw new Error(`Không tìm thấy file mẫu với ID: ${sample_id}. Lỗi: ${sampleError?.message}`);
    }
    const file_url = sampleData.public_url;

    const apiUrl = "https://gateway.vivoo.work/v1m/voice/clone";
    const apiBody = {
      voice_name: voice_name,
      preview_text: preview_text,
      file_url: file_url,
      language_tag: "Vietnamese",
    };

    const response = await fetch(apiUrl, { 
      method: "POST", 
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" }, 
      body: JSON.stringify(apiBody) 
    });
    const responseData = await response.json();
    
    logPayload.status_code = response.status;
    logPayload.status_text = response.statusText;
    logPayload.response_body = responseData;

    if (!response.ok) throw new Error(responseData.message || `API clone voice báo lỗi với mã ${response.status}`);

    if (responseData.success === true) {
        const newVoiceId = responseData.clone_voice_id;
        if (!newVoiceId) throw new Error("API không trả về ID giọng nói đã clone.");

        const { error: insertError } = await supabaseAdmin
            .from('cloned_voices')
            .insert({
                voice_id: newVoiceId,
                user_id: user.id,
                voice_name: voice_name,
                sample_audio: responseData.sample_audio || null,
                cover_url: responseData.cover_url || null,
            });
        if (insertError) throw new Error(`Lỗi lưu giọng nói vào CSDL: ${insertError.message}`);
    } else {
        throw new Error(responseData.message || "API báo lỗi không thành công.");
    }

    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    logPayload.response_body = { error: err.message };
    if (!logPayload.status_code) logPayload.status_code = 500;
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    if (logPayload.user_id) {
      const { error: logError } = await supabaseAdmin.from("voice_clone_logs").insert(logPayload);
      if (logError) console.error("Lỗi ghi log clone voice:", logError);
    }
  }
});