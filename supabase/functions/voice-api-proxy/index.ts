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
    
    const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError) throw new Error(userError.message);
    if (!authUser) throw new Error("User not found");
    user = authUser;

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_voice_api_keys")
      .select("api_key")
      .limit(1)
      .single();

    if (apiKeyError || !apiKeyData) {
      throw new Error("Chưa có API Key Voice nào được cấu hình trong hệ thống. Vui lòng liên hệ quản trị viên.");
    }
    const apiKey = apiKeyData.api_key;

    const { path, method, body } = await req.json();
    const apiUrl = `https://gateway.vivoo.work/${path}`;

    const voice_name = body?.voice_name;
    const { voice_name: _removed, ...apiBody } = body || {};

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
      const logPayload = { user_id: user.id, task_id: taskId || null, request_payload: body, response_body: responseData, status_code: apiResponse.status };
      const { error: logError } = await supabaseAdmin.from("tts_logs").insert(logPayload);
      if (logError) console.error("Failed to write to tts_logs:", logError);

      if (taskId && apiResponse.ok) {
        const { error: dbError } = await supabaseAdmin.from("voice_tasks").insert({ id: taskId, user_id: user.id, voice_name: voice_name, status: 'doing', task_type: 'minimax_tts' });
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