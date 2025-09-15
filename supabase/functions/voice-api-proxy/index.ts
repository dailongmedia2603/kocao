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

    let apiKey;
    const { data: userApiKeyData } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (userApiKeyData) {
      apiKey = userApiKeyData.api_key;
    } else {
      const { data: systemApiKeyData } = await supabaseAdmin
        .from("user_voice_api_keys")
        .select("api_key")
        .limit(1)
        .single();
      
      if (systemApiKeyData) {
        apiKey = systemApiKeyData.api_key;
      } else {
        throw new Error("Chưa có bất kỳ API Key Voice nào được cấu hình trong toàn bộ hệ thống.");
      }
    }

    const voice_name = body?.voice_name;
    const { voice_name: _removed, ...apiBody } = body || {};

    const apiUrl = `https://gateway.vivoo.work/${path}`;
    const fetchOptions = {
      method: method,
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: (method !== 'GET' && Object.keys(apiBody).length > 0) ? JSON.stringify(apiBody) : undefined,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    const responseData = await apiResponse.json();

    // Ghi log cho tất cả các yêu cầu TTS
    if (path === "v1m/task/text-to-speech" && method === "POST") {
      const taskId = responseData?.task_id;
      const logPayload = { user_id: userId, task_id: taskId || null, request_payload: body, response_body: responseData, status_code: apiResponse.status };
      await supabaseAdmin.from("tts_logs").insert(logPayload);

      // **THE FIX IS HERE: Insert into the new table with the correct data**
      if (taskId && apiResponse.ok) {
        await supabaseAdmin.from("voice_tasks").insert({ 
          id: taskId, // Use the real task_id from the API
          user_id: userId, 
          voice_name: voice_name, 
          status: 'doing', 
          task_type: 'minimax_tts' 
        });
      }
    }

    if (!apiResponse.ok) {
      let errorMessage = responseData.message || JSON.stringify(responseData);
      throw new Error(errorMessage);
    }

    // Luôn trả về success: true nếu không có lỗi
    return new Response(JSON.stringify({ success: true, ...responseData }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    // Bắt lỗi và trả về 200 OK với success: false
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});