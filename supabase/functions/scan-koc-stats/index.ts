// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (_req) => {
  if (_req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Lấy tất cả token và map theo user_id
    const { data: allTokens, error: tokensError } = await supabaseAdmin
      .from("user_tiktok_tokens")
      .select("user_id, access_token");
    if (tokensError) throw tokensError;

    const tokenMap = new Map();
    for (const token of allTokens) {
      tokenMap.set(token.user_id, token.access_token);
    }

    // 2. Lấy tất cả KOCs có channel_url
    const { data: kocs, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("id, channel_url, user_id")
      .not("channel_url", "is", null);

    if (fetchError) throw fetchError;
    if (!kocs || kocs.length === 0) {
      return new Response(JSON.stringify({ message: "Không có KOC nào để quét." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Quét từng KOC với token tương ứng
    const scanPromises = kocs.map(async (koc) => {
      const accessToken = tokenMap.get(koc.user_id);
      if (!accessToken) {
        console.warn(`Không tìm thấy token cho user ${koc.user_id} (KOC ID: ${koc.id}), bỏ qua.`);
        return { id: koc.id, status: 'skipped', reason: 'No token for user' };
      }
      
      try {
        const apiUrl = `https://api.akng.io.vn/tiktok/user?input=${encodeURIComponent(koc.channel_url)}&access_token=${accessToken}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.error(`Lỗi API cho KOC ${koc.id}: ${response.statusText}`);
          return { id: koc.id, status: 'failed', reason: response.statusText };
        }

        const stats = await response.json();
        
        // SỬA LỖI: Đọc đúng đường dẫn dữ liệu từ statsV2
        const statsData = stats?.data?.userInfo?.statsV2;
        const followerCount = statsData?.followerCount;
        const likeCount = statsData?.heartCount;
        const videoCount = statsData?.videoCount;

        if (followerCount !== undefined && likeCount !== undefined && videoCount !== undefined) {
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
            console.error(`Lỗi cập nhật DB cho KOC ${koc.id}:`, updateError.message);
            return { id: koc.id, status: 'failed', reason: 'DB update error' };
          }
          return { id: koc.id, status: 'success' };
        } else {
          console.warn(`Dữ liệu không đầy đủ từ API cho KOC ${koc.id}`);
          return { id: koc.id, status: 'skipped', reason: 'Incomplete API data' };
        }
      } catch (e) {
        console.error(`Lỗi xử lý KOC ${koc.id}:`, e.message);
        return { id: koc.id, status: 'failed', reason: e.message };
      }
    });

    const results = await Promise.all(scanPromises);
    const successCount = results.filter(r => r.status === 'success').length;

    return new Response(JSON.stringify({ message: `Quét hoàn tất. Cập nhật thành công ${successCount}/${kocs.length} KOCs.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});