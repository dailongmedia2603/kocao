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

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("User not found");

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from("user_voice_api_keys").select("api_key").eq("user_id", user.id).limit(1).single();
    if (apiKeyError || !apiKeyData) throw new Error("Không tìm thấy API Key.");
    
    const formData = await req.formData();
    const apiUrl = "https://gateway.vivoo.work/v1m/voice/clone";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "xi-api-key": apiKeyData.api_key },
      body: formData,
    });

    const responseData = await response.json();
    if (!response.ok) throw new Error(responseData.message || JSON.stringify(responseData));

    return new Response(JSON.stringify(responseData), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});