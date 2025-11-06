// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://chatbot.qcv.vn/api/chat-vision";

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

    const externalApiFormData = new FormData();
    externalApiFormData.append("prompt", fullPrompt);

    const response = await fetch(API_URL, {
      method: "POST",
      body: externalApiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi từ API GPT Custom: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    if (!responseData.answer) {
        throw new Error("API GPT Custom không trả về trường 'answer'.");
    }

    const generatedText = responseData.answer;

    const results = {
      content: generatedText,
      logs: [{
        timestamp: new Date().toISOString(),
        action: 'create',
        model_used: 'gpt-custom',
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