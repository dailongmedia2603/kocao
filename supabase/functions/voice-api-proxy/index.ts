// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError) throw new Error(userError.message);
    if (!user) throw new Error("User not found");

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (apiKeyError || !apiKeyData) {
      return new Response(JSON.stringify({ error: "Không tìm thấy API Key. Vui lòng thêm key trong Cài đặt." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = apiKeyData.api_key;

    const { path, method, body } = await req.json();
    const apiUrl = `https://gateway.vivoo.work/${path}`;

    const fetchOptions = {
      method: method,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    const responseData = await apiResponse.json();

    if (!apiResponse.ok) {
      const errorMessage = responseData.message || JSON.stringify(responseData);
      return new Response(JSON.stringify({ error: errorMessage }), { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});