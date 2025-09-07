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

    let responseData;
    try {
      const response = await fetch(checkUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      responseData = await response.json();
    } catch (fetchError) {
      throw new Error(`Không thể kết nối đến URL kiểm tra hoặc phản hồi không hợp lệ: ${fetchError.message}`);
    }

    if (responseData && responseData.success === true) {
      return new Response(JSON.stringify({ success: true, message: responseData.message || "Kết nối thành công!" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMessage = responseData.message || "Kiểm tra thất bại. Proxy không trả về 'success: true'.";
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