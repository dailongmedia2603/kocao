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
  
  try {
    const { path, method, body, userId: providedUserId } = await req.json();
    let userId;

    if (providedUserId) {
      userId = providedUserId;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Missing Authorization header");
      const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
      if (userError || !authUser) throw new Error("Invalid or expired token.");
      userId = authUser.id;
    }

    // Fetch user-specific API key
    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .limit(1)
      .single();
      
    let apiKey;
    if (apiKeyError || !apiKeyData) {
      // Fallback to system-wide key if user has no key
      console.warn(`No API key for user ${userId}, falling back to system-wide key.`);
      const { data: systemApiKeys, error: systemApiKeyError } = await supabaseAdmin
        .from("user_voice_api_keys")
        .select("api_key")
        .limit(1);
      
      if (systemApiKeyError || !systemApiKeys || systemApiKeys.length === 0) {
        throw new Error("Chưa có bất kỳ API Key Voice nào được cấu hình trong toàn bộ hệ thống.");
      }
      apiKey = systemApiKeys[0].api_key;
    } else {
      apiKey = apiKeyData.api_key;
    }

    const voice_name = body?.voice_name;
    const cloned_voice_id = body?.voice_setting?.voice_id;
    const cloned_voice_name = body?.cloned_voice_name;

    const { voice_name: _removed, cloned_voice_name: _removed2, ...apiBody } = body || {};

    const apiUrl = `https://gateway.vivoo.work/${path}`;
    const fetchOptions = {
      method: method,
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: (method !== 'GET' && Object.keys(apiBody).length > 0) ? JSON.stringify(apiBody) : undefined,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    const responseData = await apiResponse.json();

    if (path === "v1m/task/text-to-speech" && method === "POST") {
      const taskId = responseData?.task_id;
      const logPayload = { user_id: userId, task_id: taskId || null, request_payload: body, response_body: responseData, status_code: apiResponse.status };
      await supabaseAdmin.from("tts_logs").insert(logPayload);

      if (taskId && apiResponse.ok) {
        await supabaseAdmin.from("voice_tasks").insert({ 
          id: taskId,
          user_id: userId, 
          voice_name: voice_name, 
          status: 'doing', 
          task_type: 'minimax_tts',
          cloned_voice_id: cloned_voice_id,
          cloned_voice_name: cloned_voice_name || 'Không rõ'
        });
      }
    }

    if (!apiResponse.ok) {
      let errorMessage = responseData.message || JSON.stringify(responseData);
      throw new Error(errorMessage);
    }

    const payload = (typeof responseData === 'object' && responseData !== null && !Array.isArray(responseData))
      ? { ...responseData }
      : { data: responseData };

    return new Response(JSON.stringify({ success: true, ...payload }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});