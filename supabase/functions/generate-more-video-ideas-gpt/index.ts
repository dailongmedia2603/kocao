// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

// New robust multi-layered parsing function
function parseAIResponse(rawText: string): any[] {
  const text = rawText.trim();

  // --- Layer 1: Clean JSON parsing ---
  try {
    const ideas = JSON.parse(text);
    if (Array.isArray(ideas) && ideas.length > 0) return ideas;
  } catch (e) { /* ignore and move to next layer */ }

  // --- Layer 2: JSON in Markdown or with surrounding text ---
  const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[1]) {
    try {
      const ideas = JSON.parse(markdownMatch[1].trim());
      if (Array.isArray(ideas) && ideas.length > 0) return ideas;
    } catch (e) { /* ignore */ }
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const potentialJson = text.substring(firstBracket, lastBracket + 1);
      const ideas = JSON.parse(potentialJson);
      if (Array.isArray(ideas) && ideas.length > 0) return ideas;
    } catch (e) { /* ignore */ }
  }
  
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
     try {
      const potentialJson = text.substring(firstBrace, lastBrace + 1);
      const ideas = JSON.parse(potentialJson);
      if (!Array.isArray(ideas) && typeof ideas === 'object') return [ideas];
      if (Array.isArray(ideas) && ideas.length > 0) return ideas;
    } catch (e) { /* ignore */ }
  }

  // --- Layer 3: Custom Tag Parsing ---
  const newIdeas = [];
  const ideaRegex = /<IDEA>([\s\S]*?)<\/IDEA>/gi;
  let match;
  while ((match = ideaRegex.exec(text)) !== null) {
    const ideaContent = match[1];
    const title = extractContentByTag(ideaContent, 'IDEA_TITLE');
    const script = extractContentByTag(ideaContent, 'IDEA_SCRIPT');
    if (title && script) {
      newIdeas.push({ pillar: "Bổ sung", topic: title, description: script });
    }
  }

  if (newIdeas.length > 0) {
    return newIdeas;
  }

  // If all parsing layers fail, throw an error.
  console.error("All parsing layers failed for AI response:", rawText);
  throw new Error("Phản hồi từ AI không thể được phân tích cú pháp. Định dạng không mong đợi.");
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

**OUTPUT FORMATTING RULES (VERY IMPORTANT):**
1.  Your primary response format MUST be a single, valid JSON array of 10 objects.
2.  Each object in the array must have this exact structure:
    {
      "pillar": "string",
      "topic": "string",
      "description": "string"
    }
3.  The "pillar" value must be one of the provided Content Pillars.
4.  Do NOT include any text, explanations, or markdown backticks (\`\`\`) outside of the JSON array.

**FALLBACK FORMAT (ONLY if you cannot generate valid JSON):**
If you are absolutely unable to generate a valid JSON array, you MUST use the following tag-based format for each idea:
<IDEA>
<IDEA_TITLE>Catchy Video Title Here</IDEA_TITLE>
<IDEA_SCRIPT>Detailed script or description here.</IDEA_SCRIPT>
</IDEA>
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

    // 1. Try to get user-specific prompt
    let { data: customPromptData, error: userPromptError } = await supabaseClient
      .from('prompt_templates')
      .select('content, api_provider')
      .eq('user_id', plan.user_id)
      .eq('template_type', 'generate_more_ideas_gpt')
      .single();

    // 2. If not found, try to get admin's default prompt
    if (userPromptError || !customPromptData) {
      const { data: adminUser } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (adminUser) {
        const { data: adminPromptData } = await supabaseClient
          .from('prompt_templates')
          .select('content, api_provider')
          .eq('user_id', adminUser.id)
          .eq('template_type', 'generate_more_ideas_gpt')
          .single();
        
        if (adminPromptData) {
          customPromptData = adminPromptData;
        }
      }
    }

    const promptTemplate = customPromptData?.content || MORE_IDEAS_DEFAULT_PROMPT;
    const apiProvider = customPromptData?.api_provider || 'gpt-custom';

    const parsedInitialPlan = parseContentPlan(plan.results?.content || '');
    const existingIdeasText = (plan.results?.video_ideas || [])
      .map((idea: any) => `- ${idea.topic}`)
      .concat(parsedInitialPlan.ideas.map((idea: any) => `- ${idea.title}`))
      .join('\n');

    const fullPrompt = promptTemplate
      .replace(/{{STRATEGY}}/g, parsedInitialPlan.strategy)
      .replace(/{{PILLARS}}/g, parsedInitialPlan.pillars.map(p => p.title).join(', '))
      .replace(/{{TARGET_AUDIENCE}}/g, plan.inputs.target_audience)
      .replace(/{{KOC_INFO}}/g, plan.inputs.koc_persona)
      .replace(/{{EXISTING_IDEAS}}/g, existingIdeasText || 'Không có');

    let response;
    const externalApiFormData = new FormData();
    externalApiFormData.append("prompt", fullPrompt);

    if (apiProvider === 'gemini-custom') {
        const apiToken = Deno.env.get("GEMINI_CUSTOM_TOKEN");
        if (!apiToken) throw new Error("GEMINI_CUSTOM_TOKEN secret is not set.");
        externalApiFormData.append("token", apiToken);
        response = await fetch("https://aquarius.qcv.vn/api/chat", {
            method: "POST",
            body: externalApiFormData,
        });
    } else { // Default to gpt-custom
        response = await fetch("https://chatbot.qcv.vn/api/chat-vision", {
            method: "POST",
            body: externalApiFormData,
        });
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("The model is overloaded") || errorText.includes("Service Unavailable")) {
        throw new Error(`Dịch vụ AI (${apiProvider}) hiện đang quá tải. Vui lòng thử lại sau ít phút.`);
      }
      throw new Error(`Lỗi từ API ${apiProvider}: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    if (!responseData.answer) {
        throw new Error(`API ${apiProvider} không trả về trường 'answer'.`);
    }

    const rawAnswer = responseData.answer;
    const newIdeas = parseAIResponse(rawAnswer);

    const updatedIdeas = [...(plan.results.video_ideas || []), ...newIdeas];
    const existingLogs = plan.results.logs || [];
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      action: 'generate_more_ideas',
      model_used: apiProvider,
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