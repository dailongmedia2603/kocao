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
      **VAI TRÒ:** Bạn là một chuyên gia chiến lược nội dung hàng đầu cho TikTok.

      **BỐI CẢNH:** Bạn đang tạo một kế hoạch nội dung cho KOC có tên "${kocName}". Dưới đây là các thông tin được cung cấp:
      - **Chủ đề chính:** ${inputs.topic}
      - **Đối tượng mục tiêu:** ${inputs.target_audience}
      - **Chân dung KOC (Tính cách & Phong cách):** ${inputs.koc_persona}
      - **Mục tiêu kênh:** ${inputs.goals || 'Xây dựng nhận diện thương hiệu và tăng lượng người theo dõi.'}

      **NHIỆM VỤ:** Dựa trên bối cảnh trên, hãy tạo ra một kế hoạch nội dung toàn diện, chi tiết và dễ đọc.

      **YÊU CẦU ĐẦU RA:**
      Hãy trình bày kế hoạch dưới dạng văn bản được định dạng rõ ràng bằng markdown. Kế hoạch phải bao gồm các phần sau:

      1.  **Chiến lược tổng thể:** Một đoạn văn ngắn gọn (3-4 câu) tóm tắt chiến lược nội dung cốt lõi.
      2.  **Các trụ cột nội dung chính:** Liệt kê 3 trụ cột nội dung chính.
      3.  **Lịch đăng đề xuất:** Đề xuất lịch đăng cho giai đoạn đầu và giai đoạn duy trì.
      4.  **10-15 Ý tưởng video chi tiết:** Với mỗi ý tưởng, hãy cung cấp:
          - **Tiêu đề video hấp dẫn.**
          - **Kịch bản chi tiết (dạng văn nói, khoảng 150-250 từ) bao gồm câu mở đầu, các ý chính và lời kêu gọi hành động.**

      **QUAN TRỌNG:** Trình bày rõ ràng, chuyên nghiệp và chỉ trả về nội dung kế hoạch.
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