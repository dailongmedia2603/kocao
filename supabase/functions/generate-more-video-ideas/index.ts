// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.11.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- START INLINED PARSER ---
// Helper function to parse content plan from text format
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
    const pillarRegex = /<PILLAR>([\s\S]*?)<\/PILLAR>/gi;
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
    const ideaRegex = /<IDEA>([\s\S]*?)<\/IDEA>/gi;
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
// --- END INLINED PARSER ---

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId } = await req.json()
    if (!planId) throw new Error("planId is required.");

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");

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

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    let newIdeas;
    try {
      newIdeas = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini:", text);
      throw new Error("Phản hồi từ AI không phải là JSON hợp lệ.");
    }

    if (!Array.isArray(newIdeas)) throw new Error("Phản hồi của AI không ở định dạng mảng như mong đợi.");

    const updatedIdeas = [...(plan.results.video_ideas || []), ...newIdeas];
    const { error: updateError } = await supabaseClient
      .from('content_plans')
      .update({ results: { ...plan.results, video_ideas: updatedIdeas } })
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