// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      // --- Primary API: Gemini Custom ---
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

      // --- Fallback API: Vertex AI ---
      const { data: credData, error: credError } = await supabaseClient
        .from('user_vertex_ai_credentials')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (credError || !credData) {
        throw new Error("Gemini Custom failed and no Vertex AI credential is configured for fallback.");
      }

      const { data: vertexData, error: vertexError } = await supabaseClient.functions.invoke("vertex-ai-proxy", {
        body: { prompt: fullPrompt, credentialId: credData.id }
      });

      if (vertexError) throw new Error(`Vertex AI fallback error: ${vertexError.message}`);
      if (vertexData.error) throw new Error(`Vertex AI fallback error: ${vertexData.error}`);
      if (!vertexData.text) throw new Error("Vertex AI API did not return a 'text' field.");

      generatedText = vertexData.text;
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