// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { groupId, apiKey } = await req.json();
    if (!groupId || !apiKey) throw new Error("Thiếu groupId hoặc apiKey.");

    const response = await fetch(`https://api.minimax.chat/v1/text_to_speech/voices?GroupId=${groupId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });

    const responseData = await response.json();
    if (!response.ok) throw new Error(responseData.base_resp?.status_msg || "API Key hoặc Group ID không hợp lệ.");

    return new Response(JSON.stringify({ success: true, message: "Kết nối thành công!" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});