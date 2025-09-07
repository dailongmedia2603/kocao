// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { kocId } = await req.json();
    if (!kocId) {
      throw new Error("Thiếu KOC ID.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Lấy KOC và user_id của người sở hữu
    const { data: koc, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("id, channel_url, user_id")
      .eq("id", kocId)
      .single();

    if (fetchError) throw fetchError;
    if (!koc) {
      throw new Error(`Không tìm thấy KOC với ID: ${kocId}`);
    }
    if (!koc.channel_url) {
      throw new Error("KOC này không có link kênh để quét.");
    }

    // 2. Lấy Access Token từ cài đặt của người dùng
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("user_tiktok_tokens")
      .select("access_token")
      .eq("user_id", koc.user_id)
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      throw new Error("Không tìm thấy Access Token TikTok nào được cấu hình. Vui lòng thêm token trong phần Cài đặt.");
    }
    const accessToken = tokenData.access_token;

    // 3. Gọi API TikTok với đúng token
    const apiUrl = `https://api.akng.io.vn/tiktok/user?input=${encodeURIComponent(koc.channel_url)}&access_token=${accessToken}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi API Proxy: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const stats = await response.json();
    
    // SỬA LỖI: Đọc đúng đường dẫn dữ liệu từ statsV2
    const statsData = stats?.data?.userInfo?.statsV2;
    const followerCount = statsData?.followerCount;
    const likeCount = statsData?.heartCount;
    const videoCount = statsData?.videoCount;

    if (followerCount === undefined || likeCount === undefined || videoCount === undefined) {
      throw new Error("Dữ liệu trả về từ API không đầy đủ hoặc không hợp lệ.");
    }

    // 4. Cập nhật DB (chuyển đổi chuỗi thành số)
    const { error: updateError } = await supabaseAdmin
      .from("kocs")
      .update({
        follower_count: parseInt(followerCount, 10),
        like_count: parseInt(likeCount, 10),
        video_count: parseInt(videoCount, 10),
        stats_updated_at: new Date().toISOString(),
      })
      .eq("id", koc.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ message: `Quét và cập nhật thành công cho KOC.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Trả về 200 để client có thể đọc thông báo lỗi
    });
  }
});