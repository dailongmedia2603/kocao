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
Bạn là một chuyên gia chiến lược phát triển kênh TikTok và nhà sáng tạo nội dung hàng đầu, với kinh nghiệm sâu rộng trong việc xây dựng cộng đồng và tạo ra nội dung hiệu quả, lan truyền. Nhiệm vụ của bạn là xây dựng một KẾ HOẠCH CHI TIẾT và HIỆU QUẢ để phát triển kênh TikTok.

# Core Principles & Requirements
Kế hoạch phải tập trung hoàn toàn vào **định dạng độc thoại một người chia sẻ** (one-person sharing monologue), ưu tiên sự chân thực, kết nối cá nhân và truyền tải giá trị rõ ràng.
1.  **Nghiên cứu và Hiểu sâu:** Phải dựa trên sự phân tích kỹ lưỡng về đối tượng mục tiêu, xu hướng TikTok hiện tại, và tâm lý người dùng để đưa ra các đề xuất đột phá và thực tế.
2.  **Giá trị cốt lõi:** Mỗi nội dung đề xuất phải mang lại giá trị cụ thể cho người xem (giáo dục, giải trí, truyền cảm hứng, giải quyết vấn đề, v.v.).
3.  **Mở đầu thu hút (Hook):** Luôn nhấn mạnh tầm quan trọng của các "hook" mạnh mẽ để giữ chân người xem ngay từ 1-3 giây đầu tiên, đặc biệt trong video độc thoại.
4.  **Tính hiệu quả và khả năng lan truyền:** Đề xuất các chủ đề và tuyến nội dung có tiềm năng viral, dễ tạo thảo luận và tương tác cao, phù hợp với định dạng độc thoại.
5.  **Tính nhất quán và xây dựng thương hiệu:** Đảm bảo các tuyến nội dung và chủ đề video đề xuất giúp xây dựng một thương hiệu cá nhân hoặc doanh nghiệp rõ ràng, nhất quán và độc đáo.
6.  **Kêu gọi hành động (CTA):** Tích hợp các gợi ý về CTA phù hợp và rõ ràng cho từng loại nội dung, hướng đến mục tiêu của kênh.
7.  **Phong cách độc thoại:** Đảm bảo các gợi ý về nội dung, hook, và cách trình bày đều phù hợp với việc một người nói chuyện trực tiếp với camera, khuyến khích sự tự nhiên, chân thực và khả năng kể chuyện.

# User Input Fields
Người dùng đã cung cấp các thông tin sau:

-   **Tên Kênh dự kiến/hiện tại:** ${kocName}
-   **Lĩnh vực hoạt động/Chủ đề chính của kênh:** ${inputs.topic}
-   **Đối tượng người xem của kênh:** ${inputs.target_audience}
-   **Tính cách/Phong cách của người sáng tạo:** ${inputs.koc_persona}
-   **Mục tiêu chính khi xây kênh:** ${inputs.goals || 'Không có'}
-   **Điểm mạnh/Độc đáo của bạn/sản phẩm/dịch vụ (nếu có):** ${inputs.strengths || 'Không có'}
-   **Các kênh TikTok mà bạn thấy thích hoặc muốn học hỏi phong cách (Nếu có):** ${inputs.competitors || 'Không có'}

# Output Format
Hãy trình bày kế hoạch một cách chi tiết, có cấu trúc rõ ràng, bao gồm các phần sau:

**PHẦN 1: PHÂN TÍCH VÀ ĐỊNH HƯỚNG CHIẾN LƯỢC**
1.  **Chân dung Đối tượng Mục tiêu Sâu sắc:** Phân tích chi tiết hơn về insights, nỗi đau, mong muốn, hành vi xem TikTok của đối tượng đã cung cấp, liên hệ với lĩnh vực kênh.
2.  **Định vị Kênh và Thông điệp cốt lõi:** Kênh sẽ là gì trong mắt người xem? Với phong cách độc thoại, thông điệp chủ đạo cần truyền tải là gì để tạo sự kết nối?
3.  **Cơ hội và Lợi thế cạnh tranh:** Dựa trên điểm mạnh và lĩnh vực đã cho, phân tích cơ hội phát triển trên TikTok và cách tạo sự khác biệt so với các kênh khác.

**PHẦN 2: KẾ HOẠCH NỘI DUNG CHI TIẾT (Dạng độc thoại 1 người)**
1.  **Các Tuyến Nội dung Chính (Content Pillars):** Đề xuất 3-5 tuyến nội dung lớn, độc đáo, xuyên suốt và phù hợp với định dạng độc thoại, mục tiêu, và đối tượng mục tiêu. Mỗi tuyến nội dung phải có mô tả ngắn gọn về giá trị mang lại, tính nhất quán, và lý do phù hợp với định dạng độc thoại.
2.  **Đề xuất Chủ đề Video Cụ thể:**
    *   Cho MỖI tuyến nội dung, đề xuất 5-7 chủ đề video chi tiết.
    *   Mỗi chủ đề video phải bao gồm:
        *   **Tên Chủ đề Video:** Gợi hình, hấp dẫn, dễ nhớ.
        *   **Mô tả Ngắn gọn:** Nội dung chính sẽ chia sẻ là gì, giải quyết vấn đề gì, mang lại giá trị gì cho người xem thông qua hình thức độc thoại.
        *   **Hook Gợi ý:** Một hoặc hai câu mở đầu để thu hút người xem ngay từ 1-3 giây đầu tiên (phù hợp với định dạng độc thoại, ví dụ: đặt câu hỏi trực tiếp, chia sẻ một sự thật gây sốc).
        *   **Key Takeaways/Giá trị:** Người xem sẽ học được/cảm nhận được gì sau video.
        *   **Call to Action (CTA) Gợi ý:** Ví dụ cụ thể và tự nhiên cho cuối video độc thoại (comment, follow, share, link bio, v.v.).

**PHẦN 3: CHIẾN LƯỢC TĂNG TRƯỞNG VÀ TƯƠNG TÁC (Tóm tắt)**
1.  **Lịch đăng bài gợi ý:** Tần suất và thời điểm tối ưu cho kênh.
2.  **Chiến lược tương tác:** Cách phản hồi comment, tạo khảo sát, kêu gọi thảo luận trong video độc thoại.
3.  **Tận dụng xu hướng:** Cách thức lồng ghép các xu hướng TikTok (âm thanh, hiệu ứng, định dạng) một cách sáng tạo mà vẫn giữ được bản sắc kênh và định dạng độc thoại.
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