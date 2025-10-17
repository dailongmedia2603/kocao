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

    if (!response.ok) throw new Error(responseData.message || JSON.stringify(responseData));

    // If the clone was successful, save it to our database.
    if (responseData.success === true && responseData.data?.voice_id) {
        const { voice_id, sample_audio, cover_url } = responseData.data;
        const { error: insertError } = await supabaseAdmin
            .from('cloned_voices')
            .insert({
                voice_id: voice_id,
                user_id: user.id,
                voice_name: voiceName, // Use the name from the form for consistency
                sample_audio: sample_audio,
                cover_url: cover_url,
            });
        
        if (insertError) {
            // Log the error but don't fail the whole request, as the clone itself was successful.
            console.error("Failed to save cloned voice to DB:", insertError);
        }
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