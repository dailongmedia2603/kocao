// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { apiKey } = await req.json();
    if (!apiKey) {
      throw new Error("Thiếu API Key.");
    }

    const validationUrl = `https://api.genaipro.vn/api/v1/voice/list`;
    
    const response = await fetch(validationUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      return new Response(JSON.stringify({ success: true, message: "Kết nối thành công! API Key hợp lệ." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorData = await response.json();
      const errorMessage = errorData?.message || "API Key không hợp lệ hoặc đã hết hạn.";
      // Always return 200 OK, but with success: false in the body
      return new Response(JSON.stringify({ success: false, message: errorMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    // Always return 200 OK, but with success: false in the body
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});