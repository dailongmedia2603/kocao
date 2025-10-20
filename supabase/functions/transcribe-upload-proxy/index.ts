// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "http://36.50.54.74:8000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // We expect multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      throw new Error("File is required.");
    }

    // Create a new FormData to forward to the backend
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const apiUrl = `${API_BASE_URL}/api/v1/upload`;
    
    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Origin": "https://kocao.vercel.app",
      },
      body: backendFormData,
    });

    const responseData = await apiResponse.json();

    if (!apiResponse.ok) {
      const errorMessage = responseData.detail || JSON.stringify(responseData);
      throw new Error(errorMessage);
    }

    return new Response(JSON.stringify(responseData), {
      status: apiResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, // Return 200 so client can handle the error message
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});