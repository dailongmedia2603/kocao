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
    if (!kocId) throw new Error("Thiếu KOC ID.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: koc, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("id, channel_url, user_id")
      .eq("id", kocId)
      .single();

    if (fetchError) throw fetchError;
    if (!koc) throw new Error(`Không tìm thấy KOC với ID: ${kocId}`);
    if (!koc.channel_url) throw new Error("KOC này không có link kênh để quét.");

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("user_tiktok_tokens")
      .select("access_token")
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      throw new Error("Không tìm thấy Access Token TikTok nào được cấu hình.");
    }
    const accessToken = tokenData.access_token;

    const apiUrl = `https://api.akng.io.vn/tiktok/user?input=${encodeURIComponent(koc.channel_url)}&access_token=${accessToken}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi API Proxy: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const apiData = await response.json();
    
    const userInfo = apiData?.data?.userInfo?.user;
    const statsData = apiData?.data?.userInfo?.statsV2;

    if (!userInfo || !statsData) {
      throw new Error("Dữ liệu trả về từ API không hợp lệ.");
    }

    const { followerCount, heartCount, videoCount } = statsData;
    const { nickname, uniqueId, createTime, avatarLarger } = userInfo;

    if (followerCount === undefined || heartCount === undefined || videoCount === undefined || nickname === undefined || uniqueId === undefined || createTime === undefined || avatarLarger === undefined) {
      throw new Error("Dữ liệu trả về từ API không đầy đủ.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("kocs")
      .update({
        follower_count: parseInt(followerCount, 10),
        like_count: parseInt(heartCount, 10),
        video_count: parseInt(videoCount, 10),
        channel_nickname: nickname,
        channel_unique_id: uniqueId,
        channel_created_at: new Date(createTime * 1000).toISOString(),
        stats_updated_at: new Date().toISOString(),
        avatar_url: avatarLarger, // Tự động cập nhật avatar
      })
      .eq("id", koc.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ message: `Quét và cập nhật thành công.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});