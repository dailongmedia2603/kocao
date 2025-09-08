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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  let user;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const { data, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError) throw new Error(userError.message);
    if (!data.user) throw new Error("User not found");
    user = data.user;

    const { data: apiKeys, error: apiKeyError } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (apiKeyError) throw apiKeyError;

    if (!apiKeys || apiKeys.length === 0) {
      return new Response(JSON.stringify({ error: "Không tìm thấy API Key. Vui lòng thêm key trong Cài đặt." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = apiKeys[0].api_key;

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

    // --- LOGGING LOGIC ---
    if (path === "v1m/task/text-to-speech" && method === "POST") {
      const logPayload = {
        user_id: user.id,
        task_id: responseData?.data?.id || null,
        request_payload: body,
        response_body: responseData,
        status_code: apiResponse.status,
      };
      
      const { error: logError } = await supabaseAdmin
        .from("tts_logs")
        .insert(logPayload);
        
      if (logError) {
        // Log the error to the console but don't fail the main request
        console.error("Failed to write to tts_logs:", logError);
      }
    }
    // --- END LOGGING LOGIC ---

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