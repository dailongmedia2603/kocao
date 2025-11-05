// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getGcpAccessToken } from "@/vertex-ai-auth.ts";

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
    const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
    if (!credentialsJson) {
      throw new Error("Secret GOOGLE_CREDENTIALS_JSON chưa được cấu hình trong Supabase Vault.");
    }

    const credentials = JSON.parse(credentialsJson);
    const projectId = credentials.project_id;
    if (!projectId) {
      throw new Error("Tệp JSON trong secret không chứa 'project_id'.");
    }

    const accessToken = await getGcpAccessToken(credentials);
    const region = "us-central1";
    // Use a stable, generally available model for the smoke test
    const model = "gemini-2.5-pro";
    const validationUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
    
    const validationResponse = await fetch(validationUrl, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Send a minimal payload to test the endpoint
        contents: [{ "role": "user", "parts": [{ "text": "test" }] }],
      }),
    });

    if (!validationResponse.ok) {
      const contentType = validationResponse.headers.get("content-type");
      let errorBody;
      if (contentType && contentType.includes("application/json")) {
        const errorData = await validationResponse.json();
        errorBody = errorData.error?.message || JSON.stringify(errorData);
      } else {
        errorBody = await validationResponse.text();
      }
      throw new Error(`Vertex AI API Error (Status: ${validationResponse.status}): ${errorBody}`);
    }

    // If the request is successful, it means the connection is valid.
    return new Response(JSON.stringify({ success: true, message: `Kết nối thành công tới dự án: ${projectId}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});