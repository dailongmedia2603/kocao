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
    const { accessToken, checkUrl } = await req.json();
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, message: "Thiếu Access Token." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!checkUrl) {
      return new Response(JSON.stringify({ success: false, message: "Thiếu URL kiểm tra." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalUrl = `${checkUrl}?access_token=${accessToken}`;
    
    const response = await fetch(finalUrl);
    const responseData = await response.json();

    if (response.ok && responseData.id) {
      return new Response(JSON.stringify({ success: true, message: `Kết nối thành công! Token hợp lệ cho user: ${responseData.name || responseData.id}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMessage = responseData?.error?.message || "Token không hợp lệ hoặc đã hết hạn.";
      return new Response(JSON.stringify({ success: false, message: errorMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});