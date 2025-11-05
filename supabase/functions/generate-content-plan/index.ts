// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- START: Vertex AI Helper Functions (copied for self-containment) ---
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
// --- END: Vertex AI Helper Functions ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Get inputs from request body
    const { inputs, kocName } = await req.json();
    if (!inputs || !kocName) throw new Error("Missing 'inputs' or 'kocName' in request body.");

    // 3. Construct the detailed prompt for the AI
    const fullPrompt = `
      **ROLE:** You are a world-class content strategist for TikTok, specializing in building channels for KOCs (Key Opinion Consumers) who use a monologue (talking head) format.

      **CONTEXT:** You are creating a content plan for a KOC named "${kocName}". Here is the information provided:
      - **Main Topic:** ${inputs.topic}
      - **Target Audience:** ${inputs.target_audience}
      - **KOC Persona (Personality & Style):** ${inputs.koc_persona}
      - **Channel Goals:** ${inputs.goals || 'Build brand awareness and increase followers.'}
      - **Competitors/Reference Channels:** ${inputs.competitors || 'Not specified.'}

      **TASK:** Based on the context, generate a comprehensive content plan.

      **OUTPUT FORMAT:** Your response MUST be a single, valid JSON object. Do not include any text, explanations, or markdown formatting like \`\`\`json before or after the JSON object. The JSON object must strictly follow this structure:
      {
        "overall_strategy": "A concise paragraph (3-4 sentences) summarizing the core content strategy, tone, and unique selling proposition for this KOC.",
        "content_pillars": [
          "A string for the first content pillar (e.g., 'Product Reviews')",
          "A string for the second content pillar (e.g., 'Educational Tips')",
          "A string for the third content pillar (e.g., 'Personal Stories & Lifestyle')"
        ],
        "posting_schedule": {
          "launch_phase": {
            "videos_per_day": "A number (e.g., 2)",
            "notes": "A brief explanation for this frequency (e.g., 'To quickly build momentum and test content types.')"
          },
          "maintenance_phase": {
            "videos_per_week": "A number (e.g., 4-5)",
            "notes": "A brief explanation for this frequency (e.g., 'To maintain audience engagement without burnout.')"
          }
        },
        "video_ideas": [
          {
            "pillar": "The exact name of a content pillar from the list above",
            "topic": "A catchy, specific title for the video (max 15 words).",
            "description": "A 1-2 sentence description of the video's content and key message."
          },
          {
            "pillar": "The exact name of a content pillar from the list above",
            "topic": "Another catchy video title.",
            "description": "Another 1-2 sentence video description."
          }
        ]
      }
      
      **INSTRUCTIONS:**
      - Generate exactly 3 unique and relevant content pillars.
      - Generate a total of 10-15 video ideas, distributed among the 3 pillars.
      - All content must be suitable for a monologue/talking-head video format.
      - Ensure the tone and topics align with the KOC's persona and target audience.
    `;

    // 4. Authenticate with Vertex AI
    const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
    if (!credentialsJson) throw new Error("Secret GOOGLE_CREDENTIALS_JSON is not configured in Supabase Vault.");
    const credentials = JSON.parse(credentialsJson);
    const projectId = credentials.project_id;
    if (!projectId) throw new Error("The credentials JSON in the secret does not contain a 'project_id'.");
    const accessToken = await getGcpAccessToken(credentials);

    // 5. Call Vertex AI API
    const region = "us-central1";
    const model = "gemini-2.5-pro";
    const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const vertexResponse = await fetch(vertexUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ "role": "user", "parts": [{ "text": fullPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8, topP: 0.95 },
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
    
    // 6. Parse and return the result, including the prompt log and model used
    const resultJson = JSON.parse(generatedText);
    resultJson.prompt_log = fullPrompt;
    resultJson.model_used = model;

    return new Response(JSON.stringify({ success: true, results: resultJson }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-content-plan function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Return 200 so client-side can handle the error message
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});