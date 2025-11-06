// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGcpAccessToken } from "../_shared/vertex-ai-auth.ts";

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

    const fullPrompt = `
      **ROLE:** You are a top-tier content strategist for TikTok.

      **CONTEXT:** You are creating a content plan for a KOC named "${kocName}". Here is the provided information:
      - **Main Topic:** ${inputs.topic}
      - **Target Audience:** ${inputs.target_audience}
      - **KOC Persona (Personality & Style):** ${inputs.koc_persona}
      - **Channel Goals:** ${inputs.goals || 'Build brand awareness and increase follower count.'}

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
      <PILLAR>
      <PILLAR_TITLE>Pillar 2 Title</PILLAR_TITLE>
      <PILLAR_CONTENT>Description of the second content pillar.</PILLAR_CONTENT>
      </PILLAR>
      <PILLAR>
      <PILLAR_TITLE>Pillar 3 Title</PILLAR_TITLE>
      <PILLAR_CONTENT>Description of the third content pillar.</PILLAR_CONTENT>
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
      <IDEA>
      <IDEA_TITLE>Catchy Video Title 2</IDEA_TITLE>
      <IDEA_SCRIPT>Detailed script for the second idea.</IDEA_SCRIPT>
      </IDEA>
      ... (Generate 10-15 ideas in total)
      </IDEAS>

      **IMPORTANT:** Adhere strictly to this tag-based format. Do not add any extra explanations, notes, or markdown formatting outside of the content within the tags.
    `;

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