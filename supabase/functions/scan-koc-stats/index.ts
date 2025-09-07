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
    // Sử dụng SERVICE_ROLE_KEY để có quyền ghi vào tất cả các dòng
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Lấy access token từ secrets
    const accessToken = Deno.env.get("TIKTOK_PROXY_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("TIKTOK_PROXY_ACCESS_TOKEN secret not found.");
    }

    // 1. Lấy tất cả KOCs có channel_url
    const { data: kocs, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("id, channel_url")
      .not("channel_url", "is", null);

    if (fetchError) throw fetchError;
    if (!kocs || kocs.length === 0) {
      return new Response(JSON.stringify({ message: "Không có KOC nào để quét." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const scanPromises = kocs.map(async (koc) => {
      try {
        const apiUrl = `https://api.akng.io.vn/tiktok/user?input=${encodeURIComponent(koc.channel_url)}&access_token=${accessToken}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.error(`Lỗi khi gọi API cho KOC ${koc.id}: ${response.statusText}`);
          return { id: koc.id, status: 'failed', reason: response.statusText };
        }

        const stats = await response.json();

        // Giả định cấu trúc JSON trả về từ API
        // Ví dụ: { "data": { "stats": { "followerCount": 1200000, "heartCount": 5800000, "videoCount": 150 } } }
        // Bạn cần điều chỉnh các key này cho đúng với API thực tế
        const followerCount = stats?.data?.stats?.followerCount;
        const likeCount = stats?.data?.stats?.heartCount;
        const videoCount = stats?.data?.stats?.videoCount;

        if (followerCount !== undefined && likeCount !== undefined && videoCount !== undefined) {
          const { error: updateError } = await supabaseAdmin
            .from("kocs")
            .update({
              follower_count: followerCount,
              like_count: likeCount,
              video_count: videoCount, // Cập nhật cả số video
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