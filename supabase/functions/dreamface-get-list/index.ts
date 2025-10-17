// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "https://dapi.qcv.vn";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const logPayload = { user_id: null, action: 'get-list', request_payload: null, response_body: null, status_code: 200, error_message: null };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");
    logPayload.user_id = user.id;

    const { data: allTasks, error: allTasksError } = await supabaseAdmin.from('dreamface_tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (allTasksError) throw allTasksError;
    
    const responseData = { success: true, data: allTasks };
    logPayload.response_body = responseData; // Capture response before returning

    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[dreamface-get-list] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    logPayload.response_body = { success: false, error: error.message }; // Capture error response

    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert({ ...logPayload, action: 'get-list-ui-refresh' });
  }
});