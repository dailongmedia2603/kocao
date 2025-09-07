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
    const { accessToken } = await req.json();
    if (!accessToken) {
      throw new Error("Thiếu Access Token.");
    }

    const validationUrl = `https://api.akng.io.vn/tiktok/user/info/`;
    
    const response = await fetch(validationUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.data && data.data.user) {
         return new Response(JSON.stringify({ success: true, message: `Kết nối thành công! Token hợp lệ cho user: ${data.data.user.display_name}` }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      } else {
         return new Response(JSON.stringify({ success: true, message: "Kết nối thành công! Token hợp lệ." }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }
    } else {
      let errorMessage = `Proxy API đã trả về lỗi với mã trạng thái ${response.status}.`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else {
           errorMessage += ` Nội dung: ${JSON.stringify(errorData)}`;
        }
      } catch (e) {
        errorMessage += " Không thể đọc phản hồi từ proxy.";
      }
      
      return new Response(JSON.stringify({ success: false, message: errorMessage }), {
        status: 200, // Always return 200 OK, let the JSON body indicate the error.
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});