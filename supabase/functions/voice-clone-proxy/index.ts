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
    
    const formData = await req.formData();
    const voiceName = formData.get("voice_name") as string;
    logPayload.request_payload = { voice_name: voiceName, preview_text: formData.get("preview_text"), language_tag: "Vietnamese" };
    formData.append("language_tag", "Vietnamese");
    
    const apiUrl = "https://gateway.vivoo.work/v1m/voice/clone";
    const response = await fetch(apiUrl, { method: "POST", headers: { "xi-api-key": apiKey }, body: formData });
    const responseData = await response.json();
    
    logPayload.status_code = response.status;
    logPayload.status_text = response.statusText;
    logPayload.response_body = responseData;

    if (!response.ok) {
      throw new Error(responseData.message || JSON.stringify(responseData));
    }

    // Stricter check for successful clone and data integrity
    if (responseData.success === true) {
        const voiceData = responseData.data;
        const newVoiceId = voiceData?.voice_id;

        if (newVoiceId) {
            // If we have a voice_id, proceed to save to our database
            const { error: insertError } = await supabaseAdmin
                .from('cloned_voices')
                .insert({
                    voice_id: newVoiceId,
                    user_id: user.id,
                    voice_name: voiceName,
                    sample_audio: voiceData.sample_audio || null,
                    cover_url: voiceData.cover_url || null,
                });
            
            if (insertError) {
                console.error("Failed to save cloned voice to DB:", insertError);
                // Throw a specific, user-facing error if the database insert fails
                throw new Error(`Lỗi lưu trữ giọng nói vào CSDL: ${insertError.message}. Vui lòng thử lại hoặc liên hệ hỗ trợ.`);
            }
        } else {
            // The API reported success but didn't give us the essential voice_id. This is a critical failure.
            console.error("Clone successful according to API, but no voice_id was returned. Response data:", JSON.stringify(voiceData));
            throw new Error("Clone thành công nhưng API không trả về ID giọng nói. Vui lòng kiểm tra lại sau hoặc liên hệ hỗ trợ.");
        }
    } else {
        // The API reported failure (e.g., success: false)
        throw new Error(responseData.message || "API báo lỗi không thành công mà không có thông báo chi tiết.");
    }

    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    logPayload.response_body = { error: err.message };
    if (!logPayload.status_code) {
      logPayload.status_code = 500;
      logPayload.status_text = "Internal Server Error";
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    if (logPayload.user_id) {
      const { error: logError } = await supabaseAdmin.from("voice_clone_logs").insert(logPayload);
      if (logError) console.error("Failed to write to voice_clone_logs:", logError);
    }
  }
});