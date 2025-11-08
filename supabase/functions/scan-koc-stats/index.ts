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
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    
    const { data: tokenData, error: tokenError } = await supabaseAdmin.from("user_tiktok_tokens").select("access_token").limit(1).single();
    if (tokenError || !tokenData) {
      console.warn("No TikTok access token found in the system. Skipping KOC scan.");
      return new Response(JSON.stringify({ message: "Skipping scan: No TikTok access token configured." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }
    const accessToken = tokenData.access_token;

    // Fetch a batch of KOCs that need updating to prevent timeouts
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const { data: kocs, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("id, channel_url, user_id")
      .not("channel_url", "is", null)
      .or(`stats_updated_at.is.null,stats_updated_at.lt.${twentyThreeHoursAgo}`)
      .limit(20); // Process up to 20 KOCs per run

    if (fetchError) throw fetchError;

    if (!kocs || kocs.length === 0) {
      return new Response(JSON.stringify({ message: "No KOCs require scanning at this time." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const scanPromises = kocs.map(async (koc) => {
      try {
        const apiUrl = `https://api.akng.io.vn/tiktok/user?input=${encodeURIComponent(koc.channel_url)}&access_token=${accessToken}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.error(`Lỗi API cho KOC ${koc.id}: ${response.statusText}`);
          return { id: koc.id, status: 'failed', reason: response.statusText };
        }

        const apiData = await response.json();

        if (apiData.data && apiData.data.statusCode) {
            console.error(`Lỗi API cho KOC ${koc.id} (statusCode: ${apiData.data.statusCode}): ${apiData.data.statusMsg || 'No status message'}`);
            return { id: koc.id, status: 'failed', reason: `API Error ${apiData.data.statusCode}` };
        }

        const userInfo = apiData?.data?.userInfo?.user;
        const statsData = apiData?.data?.userInfo?.statsV2;

        if (userInfo && statsData) {
          const { followerCount, heartCount, videoCount } = statsData;
          const { nickname, uniqueId, createTime, avatarLarger } = userInfo;
          const { error: updateError } = await supabaseAdmin.from("kocs").update({ 
              follower_count: parseInt(followerCount, 10), 
              like_count: parseInt(heartCount, 10), 
              video_count: parseInt(videoCount, 10), 
              channel_nickname: nickname, 
              channel_unique_id: uniqueId, 
              channel_created_at: new Date(createTime * 1000).toISOString(), 
              stats_updated_at: new Date().toISOString(),
              avatar_url: avatarLarger 
            }).eq("id", koc.id);
          if (updateError) {
            console.error(`Lỗi DB cho KOC ${koc.id}:`, updateError.message);
            return { id: koc.id, status: 'failed', reason: 'DB update error' };
          }
          return { id: koc.id, status: 'success' };
        } else {
          console.error(`Dữ liệu API không đầy đủ cho KOC ${koc.id}:`, JSON.stringify(apiData));
          return { id: koc.id, status: 'skipped', reason: 'Incomplete API data' };
        }
      } catch (e) {
        console.error(`Lỗi xử lý KOC ${koc.id}:`, e.message);
        return { id: koc.id, status: 'failed', reason: e.message };
      }
    });

    const results = await Promise.all(scanPromises);
    const successCount = results.filter(r => r.status === 'success').length;

    return new Response(JSON.stringify({ message: `Quét hoàn tất. Cập nhật thành công ${successCount}/${kocs.length} KOCs.` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});