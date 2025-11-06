// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- START: Inlined Vertex AI Helper Functions ---
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  const binaryDer = atob(pemContents);
  const arrayBuffer = new ArrayBuffer(binaryDer.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < binaryDer.length; i++) {
    uint8Array[i] = binaryDer.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    "pkcs8",
    uint8Array,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGcpAccessToken(credentials: any): Promise<string> {
  const privateKey = await importPrivateKey(credentials.private_key);
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const encoder = new TextEncoder();
  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(encoder.encode(JSON.stringify(payload)));
  const dataToSign = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, dataToSign);
  const jwt = `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google Auth Error: ${data.error_description || "Failed to fetch access token."}`);
  return data.access_token;
}
// --- END: Inlined Vertex AI Helper Functions ---

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { inputs, kocName } = await req.json();
    if (!inputs || !kocName) throw new Error("Missing 'inputs' or 'kocName' in request body.");

    const { data: customPromptData } = await supabaseClient
      .from('prompt_templates')
      .select('content')
      .eq('user_id', user.id)
      .eq('template_type', 'content_plan_gemini')
      .single();

    let promptTemplate = customPromptData?.content || `
      **ROLE:** You are a top-tier content strategist for TikTok.

      **CONTEXT:** You are creating a content plan for a KOC named "{{KOC_NAME}}". Here is the provided information:
      - **Main Topic:** {{TOPIC}}
      - **Target Audience:** {{TARGET_AUDIENCE}}
      - **KOC Persona (Personality & Style):** {{KOC_PERSONA}}
      - **Channel Goals:** {{GOALS}}

      **TASK:** Based on the context above, create a comprehensive, detailed, and easy-to-read content plan.

      **OUTPUT REQUIREMENTS:**
      You MUST format the output using the following custom tags. Do NOT use Markdown headings.

      <TITLE>
      Content Plan Title Here
      </TITLE>

      <STRATEGY>
      A concise paragraph (3-4 sentences) summarizing the core content strategy.
      </STRATEGY>

      <PILLARS>
      <PILLAR>
      <PILLAR_TITLE>Pillar 1 Title</PILLAR_TITLE>
      <PILLAR_CONTENT>Description of the first content pillar.</PILLAR_CONTENT>
      </PILLAR>
      </PILLARS>

      <SCHEDULE>
      Proposed posting schedule for the initial and maintenance phases.
      </SCHEDULE>

      <IDEAS>
      <IDEA>
      <IDEA_TITLE>Catchy Video Title 1</IDEA_TITLE>
      <IDEA_SCRIPT>Detailed script (conversational style, ~150-250 words) including an opening hook, main points, and a call to action.</IDEA_SCRIPT>
      </IDEA>
      </IDEAS>

      **IMPORTANT:** Adhere strictly to this tag-based format. Do not add any extra explanations, notes, or markdown formatting outside of the content within the tags.
    `.trim();

    const fullPrompt = promptTemplate
      .replace(/{{KOC_NAME}}/g, kocName)
      .replace(/{{TOPIC}}/g, inputs.topic)
      .replace(/{{TARGET_AUDIENCE}}/g, inputs.target_audience)
      .replace(/{{KOC_PERSONA}}/g, inputs.koc_persona)
      .replace(/{{GOALS}}/g, inputs.goals || 'Build brand awareness and increase follower count.');

    const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
    if (!credentialsJson) throw new Error("Secret GOOGLE_CREDENTIALS_JSON is not configured in Supabase Vault.");
    const credentials = JSON.parse(credentialsJson);
    const projectId = credentials.project_id;
    if (!projectId) throw new Error("The credentials JSON in the secret does not contain a 'project_id'.");
    const accessToken = await getGcpAccessToken(credentials);

    const region = "us-central1";
    const model = "gemini-2.5-pro";
    const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const vertexResponse = await fetch(vertexUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ "role": "user", "parts": [{ "text": fullPrompt }] }],
        generationConfig: { temperature: 0.8, topP: 0.95 },
      }),
    });

    if (!vertexResponse.ok) {
      const errorBody = await vertexResponse.text();
      throw new Error(`Vertex AI API Error (Status: ${vertexResponse.status}): ${errorBody}`);
    }

    const vertexData = await vertexResponse.json();
    if (!vertexData.candidates || vertexData.candidates.length === 0) {
      if (vertexData?.promptFeedback?.blockReason) throw new Error(`Content blocked by safety settings: ${vertexData.promptFeedback.blockReason}.`);
      throw new Error("Vertex AI returned an empty response.");
    }

    const generatedText = vertexData.candidates[0].content.parts[0].text;
    
    const results = {
      content: generatedText,
      logs: [{
        timestamp: new Date().toISOString(),
        action: 'create',
        model_used: model,
        prompt: fullPrompt
      }]
    };

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-content-plan function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});