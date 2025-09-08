// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, prompt, newsContent, kocName, maxWords } = await req.json();
    if (!userId || !prompt || !newsContent || !kocName) {
      throw new Error("Thiếu thông tin cần thiết (userId, prompt, newsContent, kocName).");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (apiKeyError || !apiKeyData) {
      throw new Error("Không tìm thấy API Key Gemini cho người dùng này. Vui lòng thêm key trong Cài đặt.");
    }
    const geminiApiKey = apiKeyData.api_key;

    const fullPrompt = `
      Bạn là một chuyên gia sáng tạo nội dung cho các video ngắn trên mạng xã hội.
      Dựa vào thông tin sau đây, hãy tạo một kịch bản video hấp dẫn.

      **Tên KOC (người dẫn chuyện):** ${kocName}

      **Nội dung tin tức gốc:**
      ---
      ${newsContent}
      ---

      **Yêu cầu chi tiết từ người dùng:**
      ---
      ${prompt}
      ---
      
      **Yêu cầu bổ sung:**
      - Kịch bản phải được viết bằng tiếng Việt.
      - Giọng văn phải tự nhiên, lôi cuốn, và phù hợp với nền tảng video ngắn.
      - Chia kịch bản thành các phân cảnh rõ ràng (ví dụ: Mở đầu, Thân bài, Kết luận hoặc Phân cảnh 1, 2, 3).
      - ${maxWords ? `Độ dài kịch bản không được vượt quá ${maxWords} từ.` : 'Giữ kịch bản ngắn gọn, súc tích.'}
      - Chỉ trả về nội dung kịch bản, không thêm bất kỳ lời giải thích hay ghi chú nào khác.
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        },
      }),
    });

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok || !geminiData.candidates || geminiData.candidates.length === 0) {
      if (geminiData?.promptFeedback?.blockReason) {
        throw new Error(`Nội dung bị chặn vì lý do an toàn: ${geminiData.promptFeedback.blockReason}. Vui lòng điều chỉnh lại nội dung tin tức hoặc yêu cầu.`);
      }
      throw new Error(geminiData?.error?.message || "Lỗi từ API Gemini. Vui lòng kiểm tra lại API Key hoặc nội dung yêu cầu.");
    }

    const generatedText = geminiData.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ success: true, script: generatedText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-video-script:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Always return 200, but indicate error in the body
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});