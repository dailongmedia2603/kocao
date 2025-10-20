// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "http://36.50.54.74:8000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { path, method, body } = await req.json();
    if (!path || !method) {
      throw new Error("Path and method are required.");
    }

    const apiUrl = `${API_BASE_URL}${path}`;
    
    const fetchOptions = {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://kocao.vercel.app", // Thêm Origin header để xác thực
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    
    // Check if the response is JSON, otherwise return as text
    const contentType = apiResponse.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const responseData = await apiResponse.json();
      if (!apiResponse.ok) {
        const errorMessage = responseData.detail || JSON.stringify(responseData);
        throw new Error(errorMessage);
      }
      return new Response(JSON.stringify(responseData), {
        status: apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const responseText = await apiResponse.text();
       if (!apiResponse.ok) {
        throw new Error(responseText);
      }
      return new Response(responseText, {
        status: apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, // Return 200 so client can handle the error message
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});