// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://aquarius.qcv.vn/api/chat";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the token from environment variables (Supabase secrets)
    const apiToken = Deno.env.get("GEMINI_CUSTOM_TOKEN");
    if (!apiToken) {
      throw new Error("GEMINI_CUSTOM_TOKEN secret is not set in Supabase Vault.");
    }

    // The request from the client will be FormData
    const clientFormData = await req.formData();
    const prompt = clientFormData.get("prompt");

    if (!prompt) {
      throw new Error("Prompt is required.");
    }

    // Create a new URLSearchParams for the external API call to send as x-www-form-urlencoded
    const body = new URLSearchParams();
    body.append('prompt', prompt);
    body.append('token', apiToken);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error from external API: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});