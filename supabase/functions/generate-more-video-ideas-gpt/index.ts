// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_URL = "https://chatbot.qcv.vn/api/chat-vision";

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
  // 1. Clean the text: remove markdown code blocks and trim whitespace
  const cleanedText = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();

  // 2. Try parsing as JSON first
  try {
    const ideas = JSON.parse(cleanedText);
    if (Array.isArray(ideas) && ideas.length > 0) {
      // Validate structure
      if (ideas[0].topic && ideas[0].description) {
        return ideas;
      }
    }
  } catch (e) {
    // JSON parsing failed, proceed to tag parsing
    console.log("JSON parsing failed, falling back to tag parsing.");
  }

  // 3. Fallback to parsing with custom tags
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

Deno.serve(async (req) => {
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
      .eq('template_type', 'generate_more_ideas_gpt') // Use the shared prompt
      .single();

    const promptTemplate = customPromptData?.content || MORE_IDEAS_DEFAULT_PROMPT;

    const fullPrompt = promptTemplate
      .replace(/{{STRATEGY}}/g, parsedInitialPlan.strategy)
      .replace(/{{PILLARS}}/g, parsedInitialPlan.pillars.map(p => p.title).join(', '))
      .replace(/{{TARGET_AUDIENCE}}/g, plan.inputs.target_audience)
      .replace(/{{KOC_INFO}}/g, plan.inputs.koc_persona)
      .replace(/{{EXISTING_IDEAS}}/g, existingIdeasText || 'Không có');

    const externalApiFormData = new FormData();
    externalApiFormData.append("prompt", fullPrompt);

    const response = await fetch(API_URL, {
      method: "POST",
      body: externalApiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("The model is overloaded") || errorText.includes("Service Unavailable")) {
        throw new Error("Dịch vụ AI (GPT Custom) hiện đang quá tải. Vui lòng thử lại sau ít phút.");
      }
      throw new Error(`Lỗi từ API GPT Custom: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    if (!responseData.answer) {
        throw new Error("API GPT Custom không trả về trường 'answer'.");
    }

    const rawAnswer = responseData.answer;
    const newIdeas = parseAIResponse(rawAnswer);

    if (newIdeas.length === 0) {
        console.error("Failed to parse any ideas from GPT response:", rawAnswer);
        throw new Error("Phản hồi từ AI không thể được phân tích cú pháp. Định dạng không mong đợi.");
    }

    const updatedIdeas = [...(plan.results.video_ideas || []), ...newIdeas];
    const existingLogs = plan.results.logs || [];
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: 'generate_more_ideas',
      model_used: 'gpt-custom',
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