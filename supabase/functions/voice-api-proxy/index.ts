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

    const apiKey = Deno.env.get("SHARED_VOICE_API_KEY");
    if (!apiKey) {
      throw new Error("SHARED_VOICE_API_KEY chưa được cấu hình trong Supabase Secrets.");
    }

    const { path, method, body } = await req.json();
    const apiUrl = `https://gateway.vivoo.work/${path}`;

    // FIX: Safely handle the body to prevent crashes on GET requests (which have no body)
    const voice_name = body?.voice_name;
    const { voice_name: _removed, ...apiBody } = body || {};

    const fetchOptions = {
      method: method,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      // FIX: Only include a body for relevant methods and if it's not empty
      body: (method !== 'GET' && Object.keys(apiBody).length > 0) ? JSON.stringify(apiBody) : undefined,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    const responseData = await apiResponse.json();

    // --- LOGGING & DB INSERT LOGIC ---
    if (path === "v1m/task/text-to-speech" && method === "POST") {
      const taskId = responseData?.task_id;
      
      const logPayload = {
        user_id: user.id,
        task_id: taskId || null,
        request_payload: body, // Log the original body with voice_name
        response_body: responseData,
        status_code: apiResponse.status,
      };
      
      const { error: logError } = await supabaseAdmin.from("tts_logs").insert(logPayload);
      if (logError) console.error("Failed to write to tts_logs:", logError);

      // Insert into our own tasks table if successful
      if (taskId && apiResponse.ok) {
        const { error: dbError } = await supabaseAdmin
          .from("voice_tasks")
          .insert({
              id: taskId,
              user_id: user.id,
              voice_name: voice_name, // The new field
              status: 'doing',
              task_type: 'minimax_tts',
          });
        if (dbError) console.error("Failed to insert into voice_tasks:", dbError);
      }
    }
    // --- END LOGGING LOGIC ---

    if (!apiResponse.ok) {
      let errorMessage = responseData.message || JSON.stringify(responseData);
      if (errorMessage.includes("minimax_tts_error")) {
        errorMessage = "Lỗi từ nhà cung cấp dịch vụ giọng nói. Vui lòng thử lại sau hoặc chọn một giọng nói khác.";
      }
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