// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groupId, apiKey } = await req.json();
    if (!groupId || !apiKey) {
      throw new Error("Thiếu groupId hoặc apiKey.");
    }

    const response = await fetch(`https://api.minimax.chat/v1/text_to_speech/voices?GroupId=${groupId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.base_resp?.status_msg || "API Key hoặc Group ID không hợp lệ.");
    }

    // Success case
    const successPayload = { success: true, message: "Kết nối thành công!" };
    return new Response(JSON.stringify(successPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    // Error case: ensure the message is always a string and return a valid JSON object
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorPayload = { success: false, message: errorMessage };
    return new Response(JSON.stringify(errorPayload), {
      status: 200, // Always return 200, client-side will check the 'success' flag
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});