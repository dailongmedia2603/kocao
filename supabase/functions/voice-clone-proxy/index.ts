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
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("User not found");
    logPayload.user_id = user.id;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_voice_api_keys").select("api_key").limit(1).single();
    if (apiKeyError || !apiKeyData) {
      throw new Error("Chưa có API Key Voice nào được cấu hình trong hệ thống. Vui lòng liên hệ quản trị viên.");
    }
    const apiKey = apiKeyData.api_key;
    
    const originalFormData = await req.formData();
    const voiceName = originalFormData.get("voice_name") as string;
    const previewText = originalFormData.get("preview_text") as string;
    const originalFile = originalFormData.get("file") as File;

    if (!originalFile) {
      throw new Error("File âm thanh là bắt buộc.");
    }

    // Sanitize the filename before sending to the external API
    const fileExtension = originalFile.name.split('.').pop() || 'mp3';
    const sanitizedFileName = `audio-sample-${Date.now()}.${fileExtension}`;
    const sanitizedFile = new File([originalFile], sanitizedFileName, { type: originalFile.type });

    // Reconstruct FormData for the external API
    const externalApiFormData = new FormData();
    externalApiFormData.append("voice_name", voiceName);
    externalApiFormData.append("preview_text", previewText);
    externalApiFormData.append("file", sanitizedFile);
    externalApiFormData.append("language_tag", "Vietnamese");

    logPayload.request_payload = { voice_name: voiceName, preview_text: previewText, language_tag: "Vietnamese", original_filename: originalFile.name };
    
    const apiUrl = "https://gateway.vivoo.work/v1m/voice/clone";
    const response = await fetch(apiUrl, { method: "POST", headers: { "xi-api-key": apiKey }, body: externalApiFormData });
    const responseData = await response.json();
    
    logPayload.status_code = response.status;
    logPayload.status_text = response.statusText;
    logPayload.response_body = responseData;

    if (!response.ok) {
      throw new Error(responseData.message || JSON.stringify(responseData));
    }

    if (responseData.success === true) {
        const newVoiceId = responseData.clone_voice_id;

        if (newVoiceId) {
            const { error: insertError } = await supabaseAdmin
                .from('cloned_voices')
                .insert({
                    voice_id: newVoiceId,
                    user_id: user.id,
                    voice_name: voiceName,
                    sample_audio: responseData.sample_audio || null,
                    cover_url: responseData.cover_url || null,
                });
            
            if (insertError) {
                console.error("Failed to save cloned voice to DB:", insertError);
                throw new Error(`Lỗi lưu trữ giọng nói vào CSDL: ${insertError.message}. Vui lòng thử lại hoặc liên hệ hỗ trợ.`);
            }
        } else {
            console.error("Clone successful according to API, but no clone_voice_id was returned. Response data:", JSON.stringify(responseData));
            throw new Error("Clone thành công nhưng API không trả về ID giọng nói. Vui lòng kiểm tra lại sau hoặc liên hệ hỗ trợ.");
        }
    } else {
        throw new Error(responseData.message || "API báo lỗi không thành công mà không có thông báo chi tiết.");
    }

    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    logPayload.response_body = { error: err.message };
    if (!logPayload.status_code) {
      logPayload.status_code = 500;
      logPayload.status_text = "Internal Server Error";
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    if (logPayload.user_id) {
      const { error: logError } = await supabaseAdmin.from("voice_clone_logs").insert(logPayload);
      if (logError) console.error("Failed to write to voice_clone_logs:", logError);
    }
  }
});