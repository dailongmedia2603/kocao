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

    const accessToken = Deno.env.get("TIKTOK_PROXY_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("TIKTOK_PROXY_ACCESS_TOKEN secret not found.");
    }

    // 1. Lấy KOC từ DB
    const { data: koc, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("id, channel_url")
      .eq("id", kocId)
      .single();

    if (fetchError) throw fetchError;
    if (!koc) {
      throw new Error(`Không tìm thấy KOC với ID: ${kocId}`);
    }
    if (!koc.channel_url) {
      throw new Error("KOC này không có link kênh để quét.");
    }

    // 2. Gọi API TikTok
    const apiUrl = `https://api.akng.io.vn/tiktok/user?input=${encodeURIComponent(koc.channel_url)}&access_token=${accessToken}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lỗi API Proxy: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const stats = await response.json();
    
    const followerCount = stats?.data?.stats?.followerCount;
    const likeCount = stats?.data?.stats?.heartCount;
    const videoCount = stats?.data?.stats?.videoCount;

    if (followerCount === undefined || likeCount === undefined || videoCount === undefined) {
      throw new Error("Dữ liệu trả về từ API không đầy đủ hoặc không hợp lệ.");
    }

    // 3. Cập nhật DB
    const { error: updateError } = await supabaseAdmin
      .from("kocs")
      .update({
        follower_count: followerCount,
        like_count: likeCount,
        video_count: videoCount,
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
      status: 200, // Return 200 so client can parse the error message
    });
  }
});