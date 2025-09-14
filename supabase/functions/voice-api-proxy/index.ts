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
    let user;
    let userId;

    if (providedUserId) {
      // Case 1: Called from a server-side function, trust the provided userId
      userId = providedUserId;
    } else {
      // Case 2: Called from the client-side UI, get user from token
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Missing Authorization header");
      
      const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
      if (userError || !authUser) throw new Error("Invalid or expired token.");
      userId = authUser.id;
    }

    // **NEW LOGIC: Find a valid API key**
    let apiKey;
    // First, try to get the specific user's key
    const { data: userApiKeyData } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (userApiKeyData) {
      apiKey = userApiKeyData.api_key;
    } else {
      // If user has no key, fall back to ANY available key in the system (system-wide key)
      const { data: systemApiKeyData } = await supabaseAdmin
        .from("user_voice_api_keys")
        .select("api_key")
        .limit(1)
        .single();
      
      if (systemApiKeyData) {
        apiKey = systemApiKeyData.api_key;
      } else {
        // Only fail if there are absolutely no keys in the system
        throw new Error("Chưa có bất kỳ API Key Voice nào được cấu hình trong toàn bộ hệ thống. Vui lòng thêm ít nhất một key trong phần Cài đặt.");
      }
    }

    const voice_name = body?.voice_name;
    const { voice_name: _removed, ...apiBody } = body || {};

    const apiUrl = `https://gateway.vivoo.work/${path}`;
    const fetchOptions = {
      method: method,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: (method !== 'GET' && Object.keys(apiBody).length > 0) ? JSON.stringify(apiBody) : undefined,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    const responseData = await apiResponse.json();

    if (path === "v1m/task/text-to-speech" && method === "POST") {
      const taskId = responseData?.task_id;
      const logPayload = { user_id: userId, task_id: taskId || null, request_payload: body, response_body: responseData, status_code: apiResponse.status };
      const { error: logError } = await supabaseAdmin.from("tts_logs").insert(logPayload);
      if (logError) console.error("Failed to write to tts_logs:", logError);

      if (taskId && apiResponse.ok) {
        const { error: dbError } = await supabaseAdmin.from("voice_tasks").insert({ id: taskId, user_id: userId, voice_name: voice_name, status: 'doing', task_type: 'minimax_tts' });
        if (dbError) console.error("Failed to insert into voice_tasks:", dbError);
      }
    }

    if (!apiResponse.ok) {
      let errorMessage = responseData.message || JSON.stringify(responseData);
      if (errorMessage.includes("minimax_tts_error")) {
        errorMessage = "Lỗi từ nhà cung cấp dịch vụ giọng nói. Vui lòng thử lại sau hoặc chọn một giọng nói khác.";
      }
      return new Response(JSON.stringify({ error: errorMessage }), { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});