// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- START: Vertex AI Helper Functions ---
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


// --- START: Helper Functions ---
const extractContentByTag = (text: string, tag: string): string => {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

function parseContentPlan(text: string) {
  const result = { title: '', strategy: '', pillars: [] as any[], schedule: '', ideas: [] as any[] };
  result.title = extractContentByTag(text, 'TITLE') || 'Kế hoạch nội dung';
  result.strategy = extractContentByTag(text, 'STRATEGY');
  result.schedule = extractContentByTag(text, 'SCHEDULE');
  const pillarsBlock = extractContentByTag(text, 'PILLARS');
  if (pillarsBlock) {
    const pillarRegex = /<PILLAR>([\s\\S]*?)<\/PILLAR>/gi;
    let match;
    while ((match = pillarRegex.exec(pillarsBlock)) !== null) {
      const pillarContent = match[1];
      const title = extractContentByTag(pillarContent, 'PILLAR_TITLE');
      const content = extractContentByTag(pillarContent, 'PILLAR_CONTENT');
      if (title && content) result.pillars.push({ title, content });
    }
  }
  const ideasBlock = extractContentByTag(text, 'IDEAS');
  if (ideasBlock) {
    const ideaRegex = /<IDEA>([\s\\S]*?)<\/IDEA>/gi;
    let match;
    while ((match = ideaRegex.exec(ideasBlock)) !== null) {
      const ideaContent = match[1];
      const title = extractContentByTag(ideaContent, 'IDEA_TITLE');
      const script = extractContentByTag(ideaContent, 'IDEA_SCRIPT');
      if (title && script) result.ideas.push({ title, script });
    }
  }
  return result;
}

function parseAIResponse(rawText: string): any[] {
  const cleanedText = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();

  try {
    const ideas = JSON.parse(cleanedText);
    if (Array.isArray(ideas) && ideas.length > 0) {
      if (ideas[0].topic && ideas[0].description) {
        return ideas;
      }
    }
  } catch (e) {
    console.log("JSON parsing failed, falling back to tag parsing.");
  }

  const newIdeas = [];
  const ideaRegex = /<IDEA>([\s\S]*?)<\/IDEA>/gi;
  let match;
  while ((match = ideaRegex.exec(cleanedText)) !== null) {
    const ideaContent = match[1];
    const title = extractContentByTag(ideaContent, 'IDEA_TITLE');
    const script = extractContentByTag(ideaContent, 'IDEA_SCRIPT');
    if (title && script) {
      newIdeas.push({
        pillar: "Bổ sung",
        topic: title,
        description: script,
      });
    }
  }
  
  return newIdeas;
}
// --- END: Helper Functions ---

const MORE_IDEAS_DEFAULT_PROMPT = `
Based on the following content strategy, generate 10 new, creative, and distinct video ideas.
Do not repeat any of the existing ideas provided below.

**Content Strategy:**
- Overall Strategy: {{STRATEGY}}
- Content Pillars: {{PILLARS}}
- Target Audience: {{TARGET_AUDIENCE}}
- KOC/Channel Info: {{KOC_INFO}}

**Existing Video Ideas (Do NOT repeat these):**
{{EXISTING_IDEAS}}

Your response must be a valid JSON array of 10 objects. Each object must have this exact structure:
{
  "pillar": "string",
  "topic": "string",
  "description": "string"
}
The "pillar" value must be one of the provided Content Pillars.
`.trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId } = await req.json()
    if (!planId) throw new Error("planId is required.");

    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: plan, error: planError } = await supabaseClient
      .from('content_plans')
      .select('inputs, results, user_id')
      .eq('id', planId)
      .single();

    if (planError) throw planError;
    if (!plan) throw new Error('Content plan not found');

    const parsedInitialPlan = parseContentPlan(plan.results?.content || '');
    const existingIdeasText = (plan.results?.video_ideas || [])
      .map((idea: any) => `- ${idea.topic}`)
      .concat(parsedInitialPlan.ideas.map((idea: any) => `- ${idea.title}`))
      .join('\n');

    const { data: customPromptData } = await supabaseClient
      .from('prompt_templates')
      .select('content')
      .eq('user_id', plan.user_id)
      .eq('template_type', 'generate_more_ideas_gemini')
      .single();

    const promptTemplate = customPromptData?.content || MORE_IDEAS_DEFAULT_PROMPT;

    const fullPrompt = promptTemplate
      .replace(/{{STRATEGY}}/g, parsedInitialPlan.strategy)
      .replace(/{{PILLARS}}/g, parsedInitialPlan.pillars.map(p => p.title).join(', '))
      .replace(/{{TARGET_AUDIENCE}}/g, plan.inputs.target_audience)
      .replace(/{{KOC_INFO}}/g, plan.inputs.koc_persona)
      .replace(/{{EXISTING_IDEAS}}/g, existingIdeasText || 'Không có');

    // --- START: Vertex AI Authentication & API Call ---
    const credentialsJson = Deno.env.get("GOOGLE_CREDENTIALS_JSON");
    if (!credentialsJson) throw new Error("Secret GOOGLE_CREDENTIALS_JSON is not configured in Supabase Vault.");
    const credentials = JSON.parse(credentialsJson);
    const projectId = credentials.project_id;
    if (!projectId) throw new Error("The credentials JSON in the secret does not contain a 'project_id'.");
    const accessToken = await getGcpAccessToken(credentials);

    const region = "us-central1";
    const model = "gemini-2.5-pro"; // Or another suitable model
    const vertexUrl = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

    const vertexResponse = await fetch(vertexUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ "role": "user", "parts": [{ "text": fullPrompt }] }],
        generationConfig: { 
          temperature: 0.8, 
          topP: 0.95,
          responseMimeType: "application/json"
        },
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

    const text = vertexData.candidates[0].content.parts[0].text;
    const newIdeas = parseAIResponse(text);

    if (newIdeas.length === 0) {
      console.error("Failed to parse any ideas from Gemini response:", text);
      throw new Error("Phản hồi từ AI không thể được phân tích cú pháp.");
    }
    // --- END: Vertex AI Authentication & API Call ---

    const updatedIdeas = [...(plan.results.video_ideas || []), ...newIdeas];
    const existingLogs = plan.results.logs || [];
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: 'generate_more_ideas',
      model_used: model,
      prompt: fullPrompt
    };
    const updatedLogs = [...existingLogs, newLogEntry];

    const { error: updateError } = await supabaseClient
      .from('content_plans')
      .update({ results: { ...plan.results, video_ideas: updatedIdeas, logs: updatedLogs } })
      .eq('id', planId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});