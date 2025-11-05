// @ts-nocheck
// This comment is added to disable TypeScript checks for this file.
// This file is a Supabase Edge Function, which runs in a Deno environment.
// Your local development environment is likely configured for Node.js,
// causing type-checking errors. This code is correct for the Deno runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.11.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId } = await req.json()

    if (!planId) {
      throw new Error("planId is required.");
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables. Please configure it in your Supabase project secrets.");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch the content plan
    const { data: plan, error: planError } = await supabaseClient
      .from('content_plans')
      .select('inputs, results')
      .eq('id', planId)
      .single()

    if (planError) throw planError
    if (!plan) throw new Error('Content plan not found')

    // 2. Construct the prompt for Gemini
    const existingIdeas = plan.results.video_ideas || [];
    const prompt = `
      Based on the following content strategy, generate 10 new, creative, and distinct video ideas.
      Do not repeat any of the existing ideas provided below.

      **Content Strategy:**
      - Overall Strategy: ${plan.results.overall_strategy}
      - Content Pillars: ${plan.results.content_pillars.join(', ')}
      - Target Audience: ${plan.inputs.target_audience}
      - KOC/Channel Info: ${plan.inputs.koc_info}

      **Existing Video Ideas (Do NOT repeat these):**
      ${existingIdeas.map((idea: any) => `- ${idea.topic}`).join('\n')}

      Your response must be a valid JSON array of 10 objects. Each object must have this exact structure:
      {
        "pillar": "string",
        "topic": "string",
        "description": "string"
      }
      The "pillar" value must be one of the provided Content Pillars.
    `;

    // 3. Call Gemini API with JSON mode
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Safely parse the response from Gemini
    let newIdeas;
    try {
        newIdeas = JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini, even in JSON mode.", text);
        throw new Error("Phản hồi từ AI không phải là JSON hợp lệ. Vui lòng thử lại.");
    }

    if (!Array.isArray(newIdeas)) {
      console.error("Gemini response was not a JSON array:", text);
      throw new Error("Không thể tạo ý tưởng mới. Phản hồi của AI không ở định dạng mảng như mong đợi.");
    }

    // 5. Update the database
    const updatedIdeas = [...existingIdeas, ...newIdeas];
    const { error: updateError } = await supabaseClient
      .from('content_plans')
      .update({ results: { ...plan.results, video_ideas: updatedIdeas } })
      .eq('id', planId)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})