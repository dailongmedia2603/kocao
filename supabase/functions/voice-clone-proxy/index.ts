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
  
  let logPayload = {
    user_id: null,
    request_url: "https://gateway.vivoo.work/v1m/voice/clone",
    request_payload: {},
    response_body: null,
    status_code: null,
    status_text: null,
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("User not found");
    logPayload.user_id = user.id;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_voice_api_keys").select("api_key").eq("user_id", user.id).limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error("Không tìm thấy API Key.");
    
    const formData = await req.formData();
    
    // Log request payload (without the file)
    logPayload.request_payload = {
      voice_name: formData.get("voice_name"),
      preview_text: formData.get("preview_text"),
      language_tag: "Vietnamese",
    };
    
    formData.append("language_tag", "Vietnamese");
    
    const apiUrl = "https://gateway.vivoo.work/v1m/voice/clone";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "xi-api-key": apiKeyData.api_key },
      body: formData,
    });

    const responseData = await response.json();
    
    // Log the response
    logPayload.status_code = response.status;
    logPayload.status_text = response.statusText;
    logPayload.response_body = responseData;

    if (!response.ok) throw new Error(responseData.message || JSON.stringify(responseData));

    return new Response(JSON.stringify(responseData), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    logPayload.response_body = { error: err.message };
    if (!logPayload.status_code) {
      logPayload.status_code = 500;
      logPayload.status_text = "Internal Server Error";
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    // Insert the log into the database
    if (logPayload.user_id) {
      const { error: logError } = await supabaseAdmin
        .from("voice_clone_logs")
        .insert(logPayload);
      if (logError) {
        console.error("Failed to write to voice_clone_logs:", logError);
      }
    }
  }
});