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
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Auth Error: ${response.status} ${errorText}`);
  }
  const { access_token } = await response.json();
  return access_token;
}

const DEFAULT_PROMPT = `
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

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let { data: customPromptData } = await supabaseClient
      .from('prompt_templates')
      .select('content')
      .eq('user_id', user.id)
      .eq('template_type', 'content_plan_gpt')
      .single();

    if (!customPromptData) {
      const { data: adminUser } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin').limit(1).single();
      if (adminUser) {
        const { data: adminPromptData } = await supabaseAdmin.from('prompt_templates').select('content').eq('user_id', adminUser.id).eq('template_type', 'content_plan_gpt').single();
        if (adminPromptData) customPromptData = adminPromptData;
      }
    }

    const promptTemplate = customPromptData?.content || DEFAULT_PROMPT;

    const fullPrompt = promptTemplate
      .replace(/{{KOC_NAME}}/g, kocName)
      .replace(/{{TOPIC}}/g, inputs.topic)
      .replace(/{{TARGET_AUDIENCE}}/g, inputs.target_audience)
      .replace(/{{KOC_PERSONA}}/g, inputs.koc_persona)
      .replace(/{{GOALS}}/g, inputs.goals || 'Build brand awareness and increase follower count.');

    let generatedText = "";
    let modelUsed = "";

    try {
      console.log(`Attempting to generate content plan for "${inputs.name}" using Gemini Custom...`);
      modelUsed = "gemini-custom";
      const externalApiFormData = new FormData();
      externalApiFormData.append("prompt", fullPrompt);
      const { data: responseData, error: functionError } = await supabaseClient.functions.invoke("gemini-custom-proxy", {
        body: externalApiFormData,
      });

      if (functionError) throw new Error(`Error invoking gemini-custom-proxy: ${functionError.message}`);
      if (responseData.error) throw new Error(`Error from gemini-custom-proxy: ${responseData.error}`);
      if (!responseData.answer) throw new Error("Gemini Custom API did not return an 'answer' field.");
      
      generatedText = responseData.answer;
      console.log(`Successfully generated content plan using Gemini Custom.`);

    } catch (geminiError) {
      console.warn(`Gemini Custom failed for plan "${inputs.name}": ${geminiError.message}. Attempting fallback to Vertex AI...`);
      modelUsed = "vertex-ai";

      const { data: credData, error: credError } = await supabaseClient
        .from('user_vertex_ai_credentials')
        .select('credentials')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (credError || !credData) {
        throw new Error("Gemini Custom failed and no Vertex AI credential is configured for fallback.");
      }

      const credentials = credData.credentials;
      const projectId = credentials.project_id;
      if (!projectId) throw new Error("The provided credentials JSON is missing the 'project_id' field.");

      const accessToken = await getGoogleAccessToken(credentials);
      const vertexUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent`;
      
      const vertexResponse = await fetch(vertexUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: fullPrompt }] }] }),
      });

      if (!vertexResponse.ok) {
        const errorText = await vertexResponse.text();
        throw new Error(`Vertex AI API Error: ${vertexResponse.status} ${errorText}`);
      }

      const vertexData = await vertexResponse.json();
      generatedText = vertexData?.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";
      console.log(`Successfully generated content plan using Vertex AI fallback.`);
    }

    const results = {
      content: generatedText,
      logs: [{
        timestamp: new Date().toISOString(),
        action: 'create',
        model_used: modelUsed,
        prompt: fullPrompt
      }]
    };

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-content-plan-gpt function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});