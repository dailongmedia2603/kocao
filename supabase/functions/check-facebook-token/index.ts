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
    
    let responseData;
    try {
      const response = await fetch(finalUrl);
      responseData = await response.json();
    } catch (fetchError) {
      // This catches network errors or if the response is not valid JSON
      throw new Error(`Không thể kết nối đến URL kiểm tra hoặc phản hồi không hợp lệ: ${fetchError.message}`);
    }

    // Check for a success flag from the proxy, similar to the TikTok checker.
    if (responseData && responseData.success === true) {
      // The proxy might wrap the actual FB data in a 'data' field.
      const fbData = responseData.data || responseData;
      const successMessage = `Kết nối thành công! Token hợp lệ cho user: ${fbData.name || fbData.id}`;
      return new Response(JSON.stringify({ success: true, message: successMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (responseData && responseData.id) {
      // Fallback for when the proxy returns the raw Facebook response directly
      const successMessage = `Kết nối thành công! Token hợp lệ cho user: ${responseData.name || responseData.id}`;
       return new Response(JSON.stringify({ success: true, message: successMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    else {
      // The proxy returned a failure response. Use its message if available.
      const errorMessage = responseData.message || responseData?.error?.message || "Token không hợp lệ hoặc đã hết hạn.";
      return new Response(JSON.stringify({ success: false, message: errorMessage }), {
        status: 200, // Returning 200 for client-side handling
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 200, // Returning 200 for client-side handling
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});