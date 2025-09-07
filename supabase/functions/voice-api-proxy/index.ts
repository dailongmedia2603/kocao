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
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (apiKeyError || !apiKeyData) {
      return new Response(JSON.stringify({ error: "Không tìm thấy API Key GenAIPro Voice. Vui lòng thêm key trong Cài đặt." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = apiKeyData.api_key;

    const { path, body, method } = await req.json();
    const apiUrl = `https://genaipro.vn/api/elevenlabs/${path}`;

    const fetchOptions = {
      method: method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    
    // Try to parse JSON, but handle cases where the body might be empty
    let responseData;
    try {
      responseData = await apiResponse.json();
    } catch (e) {
      responseData = { message: apiResponse.statusText };
    }

    if (!apiResponse.ok) {
        return new Response(JSON.stringify(responseData), { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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