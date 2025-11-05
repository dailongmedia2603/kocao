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
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Get inputs from request body
    const { inputs, kocName } = await req.json();
    if (!inputs || !kocName) throw new Error("Missing 'inputs' or 'kocName' in request body.");

    // 3. Construct the detailed prompt for the AI in Vietnamese
    const fullPrompt = `
      **VAI TRÒ:** Bạn là một chuyên gia chiến lược nội dung hàng đầu cho TikTok, chuyên xây dựng kênh cho các KOC (Key Opinion Consumers) theo định dạng độc thoại (talking head).

      **BỐI CẢNH:** Bạn đang tạo một kế hoạch nội dung cho KOC có tên "${kocName}". Dưới đây là các thông tin được cung cấp:
      - **Chủ đề chính:** ${inputs.topic}
      - **Đối tượng mục tiêu:** ${inputs.target_audience}
      - **Chân dung KOC (Tính cách & Phong cách):** ${inputs.koc_persona}
      - **Mục tiêu kênh:** ${inputs.goals || 'Xây dựng nhận diện thương hiệu và tăng lượng người theo dõi.'}

      **NHIỆM VỤ:** Dựa trên bối cảnh trên, hãy tạo ra một kế hoạch nội dung toàn diện.

      **ĐỊNH DẠNG ĐẦU RA (YÊU CẦU BẮT BUỘC):** Phản hồi của bạn PHẢI là một đối tượng JSON hợp lệ duy nhất. Không bao gồm bất kỳ văn bản, giải thích, hoặc định dạng markdown nào như \`\`\`json trước hoặc sau đối tượng JSON. Đối tượng JSON phải tuân thủ nghiêm ngặt cấu trúc sau:
      {
        "overall_strategy": "Một đoạn văn ngắn gọn (3-4 câu) tóm tắt chiến lược nội dung cốt lõi, tông giọng, và điểm bán hàng độc nhất (unique selling proposition) cho KOC này.",
        "content_pillars": [
          "Một chuỗi cho trụ cột nội dung đầu tiên",
          "Một chuỗi cho trụ cột nội dung thứ hai",
          "Một chuỗi cho trụ cột nội dung thứ ba"
        ],
        "posting_schedule": {
          "build_up_phase": {
            "phase_name": "Xây dựng ban đầu",
            "duration": "1 tháng đầu",
            "total_videos": "60 video",
            "frequency": "2 video/ngày",
            "notes": "Giải thích ngắn gọn cho chiến lược này."
          },
          "maintenance_phase": {
            "phase_name": "Duy trì",
            "duration": "Từ tháng thứ 2 trở đi",
            "total_videos": "30 video/tháng",
            "frequency": "1 video/ngày",
            "notes": "Giải thích ngắn gọn cho chiến lược này."
          }
        },
        "video_ideas": [
          {
            "pillar": "Tên chính xác của một trụ cột nội dung từ danh sách trên",
            "topic": "Một tiêu đề video hấp dẫn, cụ thể (tối đa 15 từ).",
            "description": "Một kịch bản chi tiết, liền mạch, viết dưới dạng văn nói. Bắt đầu bằng một câu mở đầu thu hút, sau đó đi vào các ý chính, giải thích các thuật ngữ (nếu có), và kết thúc bằng một lời kêu gọi hành động. Độ dài khoảng 150-250 từ."
          }
        ]
      }
      
      **HƯỚNG DẪN CHI TIẾT (YÊU CẦU BẮT BUỘC):**
      - **Lịch đăng:** Sử dụng chính xác các giá trị cố định sau: Giai đoạn "Xây dựng ban đầu" (1 tháng đầu, 60 video, 2 video/ngày) và giai đoạn "Duy trì" (từ tháng thứ 2, 30 video/tháng, 1 video/ngày). Bạn chỉ cần sáng tạo phần "notes" (ghi chú) để giải thích cho chiến lược này.
      - **Ý tưởng video:** Phần 'description' PHẢI là một kịch bản chi tiết, liền mạch, không phải mô tả ngắn. Nó cần giải thích thuật ngữ, có ngữ cảnh, nêu các ý chính, và được viết như một câu chuyện hoàn chỉnh.
      - Tạo ra chính xác 3 trụ cột nội dung độc đáo và phù hợp.
      - Tạo tổng cộng 10-15 ý tưởng video, phân bổ đều cho 3 trụ cột.
      - Tất cả nội dung phải phù hợp với định dạng video độc thoại/talking-head.
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

    // 5. Clean and parse the result
    let jsonString = responseData.answer.trim();
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.substring(7);
    }
    if (jsonString.endsWith("```")) {
      jsonString = jsonString.substring(0, jsonString.length - 3);
    }
    jsonString = jsonString.trim();
    
    const resultJson = JSON.parse(jsonString);

    // 6. Add logging info for consistency
    resultJson.prompt_log = fullPrompt;
    resultJson.model_used = 'gpt-custom';

    return new Response(JSON.stringify({ success: true, results: resultJson }), {
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