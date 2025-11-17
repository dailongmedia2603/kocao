// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'npm:jose@^5.2.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGoogleAccessToken(credentials) {
  const privateKey = await jose.importPKCS8(credentials.private_key, 'RS256');
  
  const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(credentials.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime('1h')
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Auth Error: ${response.status} ${errorText}`);
  }

  const { access_token } = await response.json();
  return access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, credentialId } = await req.json();
    if (!prompt || !credentialId) {
      throw new Error("prompt and credentialId are required.");
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");

    const { data: credData, error: credError } = await supabaseAdmin
      .from('user_vertex_ai_credentials')
      .select('credentials')
      .eq('id', credentialId)
      .eq('user_id', user.id)
      .single();

    if (credError || !credData) {
      throw new Error("Could not find valid credentials for this user.");
    }

    const credentials = credData.credentials;
    const projectId = credentials.project_id;
    if (!projectId) {
      throw new Error("The provided credentials JSON is missing the 'project_id' field.");
    }

    const accessToken = await getGoogleAccessToken(credentials);

    const vertexUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-1.5-pro:generateContent`;
    
    const vertexResponse = await fetch(vertexUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!vertexResponse.ok) {
      const errorText = await vertexResponse.text();
      throw new Error(`Vertex AI API Error: ${vertexResponse.status} ${errorText}`);
    }

    const vertexData = await vertexResponse.json();
    const text = vertexData?.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, // Return 200 so client can handle the error message
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});