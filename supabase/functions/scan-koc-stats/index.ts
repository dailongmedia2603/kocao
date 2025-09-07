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

    const { data: allTokens, error: tokensError } = await supabaseAdmin
      .from("user_tiktok_tokens")
      .select("user_id, access_token");
    if (tokensError) throw tokensError;

    const tokenMap = new Map(allTokens.map(t => [t.user_id, t.access_token]));

    const { data: kocs, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("id, channel_url, user_id")
      .not("channel_url", "is", null);

    if (fetchError) throw fetchError;
    if (!kocs || kocs.length === 0) {
      return new Response(JSON.stringify({ message: "Không có KOC nào để quét." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scanPromises = kocs.map(async (koc) => {
      const accessToken = tokenMap.get(koc.user_id);
      if (!accessToken) {
        console.warn(`Không tìm thấy token cho user ${koc.user_id}, bỏ qua KOC ${koc.id}.`);
        return { id: koc.id, status: 'skipped', reason: 'No token' };
      }
      
      try {
        const apiUrl = `https://api.akng.io.vn/tiktok/user?input=${encodeURIComponent(koc.channel_url)}&access_token=${accessToken}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(response.statusText);

        const apiData = await response.json();
        const userInfo = apiData?.data?.userInfo;
        const statsData = userInfo?.statsV2;
        const userData = userInfo?.user;

        if (statsData && userData) {
          const { followerCount, heartCount, videoCount } = statsData;
          const { nickname, uniqueId, createTime } = userData;

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
            })
            .eq("id", koc.id);

          if (updateError) throw updateError;
          return { id: koc.id, status: 'success' };
        } else {
          return { id: koc.id, status: 'skipped', reason: 'Incomplete data' };
        }
      } catch (e) {
        return { id: koc.id, status: 'failed', reason: e.message };
      }
    });

    const results = await Promise.all(scanPromises);
    const successCount = results.filter(r => r.status === 'success').length;

    return new Response(JSON.stringify({ message: `Quét hoàn tất. Cập nhật thành công ${successCount}/${kocs.length} KOCs.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});