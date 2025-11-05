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
    const { inputs, kocName } = await req.json();
    if (!inputs || !kocName) throw new Error("Missing 'inputs' or 'kocName' in request body.");

    const fullPrompt = `
# Instruction for AI
Bạn là một chuyên gia chiến lược phát triển kênh TikTok và nhà sáng tạo nội dung hàng đầu. Nhiệm vụ của bạn là phân tích các thông tin được cung cấp để xây dựng một kế hoạch nội dung hiệu quả.

# Core Principles for Analysis (Your internal thinking process)
1.  **Understand Deeply:** Analyze the target audience's pain points, desires, and TikTok behavior.
2.  **Core Value:** Ensure every content idea provides specific value (education, entertainment, inspiration).
3.  **Strong Hooks:** Prioritize powerful 1-3 second hooks suitable for a monologue format.
4.  **Virality & Engagement:** Propose topics with high potential for discussion and sharing.
5.  **Brand Consistency:** Ensure content pillars build a clear, unique personal brand.
6.  **Monologue Style:** All suggestions must fit a one-person-talking-to-camera format, emphasizing authenticity and storytelling.

# User Input Fields
-   **KOC Name:** ${kocName}
-   **Topic:** ${inputs.topic}
-   **Target Audience:** ${inputs.target_audience}
-   **KOC Persona:** ${inputs.koc_persona}
-   **Main Goal:** ${inputs.goals || 'Not provided'}
-   **Strengths/Uniqueness:** ${inputs.strengths || 'Not provided'}
-   **Competitors/Inspiration:** ${inputs.competitors || 'Not provided'}

# Output Format
Dựa trên phân tích của bạn, hãy trình bày kế hoạch một cách ngắn gọn, súc tích và đi thẳng vào vấn đề. Chỉ bao gồm các phần sau:

**PHẦN 1: CÁC TUYẾN NỘI DUNG CHÍNH (CONTENT PILLARS)**
- Đề xuất 3-5 tuyến nội dung lớn, độc đáo.
- Trình bày dưới dạng danh sách gạch đầu dòng, mỗi tuyến nội dung chỉ cần một câu mô tả ngắn gọn.

**PHẦN 2: ĐỀ XUẤT CHỦ ĐỀ VIDEO CỤ THỂ**
- Cho MỖI tuyến nội dung, đề xuất 5-7 chủ đề video chi tiết.
- Mỗi chủ đề video phải bao gồm:
    *   **Tên Chủ đề Video:** Gợi hình, hấp dẫn.
    *   **Mô tả Ngắn gọn:** Nội dung chính sẽ chia sẻ.
    *   **Hook Gợi ý:** Một câu mở đầu thu hút.
    *   **Key Takeaways/Giá trị:** Người xem nhận được gì.
    *   **Call to Action (CTA) Gợi ý:** Một lời kêu gọi hành động.

**QUAN TRỌNG:** Chỉ trả về kết quả theo đúng định dạng trên. Không thêm bất kỳ lời giải thích, giới thiệu, phân tích chiến lược hay kết luận nào khác.
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

    return new Response(JSON.stringify({ success: true, results: { generatedPlan: generatedText, fullPrompt: fullPrompt } }), {
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