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
    // 1. Authenticate user (optional but good practice)
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

    // 4. Call the custom GPT API
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

    // 5. Parse and return the result
    // The answer is expected to be a JSON string.
    const resultJson = JSON.parse(responseData.answer);

    return new Response(JSON.stringify({ success: true, results: resultJson, fullPrompt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-content-plan-gpt function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Return 200 so client-side can handle the error message
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});