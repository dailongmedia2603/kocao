// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const body = await req.json().catch(() => ({}));
    const specificUserId = body.userId;
    const sourceIdsToScan = body.sourceIds;

    let sourcesQuery = supabaseAdmin.from('news_sources').select('user_id, source_id, name');
    if (specificUserId) sourcesQuery = sourcesQuery.eq('user_id', specificUserId);
    if (sourceIdsToScan && Array.isArray(sourceIdsToScan) && sourceIdsToScan.length > 0) {
      sourcesQuery = sourcesQuery.in('source_id', sourceIdsToScan);
    }

    const { data: allSources, error: sourcesError } = await sourcesQuery;
    if (sourcesError) throw sourcesError;

    if (!allSources || allSources.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Không có nguồn tin tức nào được chọn để quét." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // THAY ĐỔI QUAN TRỌNG BẮT ĐẦU TỪ ĐÂY
    // Nhóm các nguồn theo user_id để lấy token một lần cho mỗi user
    const sourcesByUser = allSources.reduce((acc, source) => {
      if (!acc[source.user_id]) {
        acc[source.user_id] = [];
      }
      acc[source.user_id].push(source);
      return acc;
    }, {});

    // Lấy token cho tất cả user cần quét
    const userIds = Object.keys(sourcesByUser);
    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from('user_facebook_tokens')
      .select('user_id, access_token')
      .in('user_id', userIds);

    if (tokenError) throw tokenError;

    const tokenMap = new Map(tokens.map(t => [t.user_id, t.access_token]));
    // KẾT THÚC THAY ĐỔI

    for (const source of allSources) {
      // Lấy đúng token cho người dùng sở hữu nguồn tin này
      const accessToken = tokenMap.get(source.user_id);
      if (!accessToken) {
        console.error(`Không tìm thấy token cho user ${source.user_id} của nguồn ${source.source_id}. Bỏ qua.`);
        continue; // Bỏ qua nếu không có token
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const since = Math.floor(startOfDay.getTime() / 1000);
      const until = Math.floor(endOfDay.getTime() / 1000);
      const fields = "id,message,created_time,permalink_url";
      const apiUrl = `https://api.akng.io.vn/graph/${source.source_id}/posts?access_token=${accessToken}&limit=100&since=${since}&until=${until}&fields=${fields}`;
      
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        await supabaseAdmin.from('news_scan_logs').insert({ user_id: source.user_id, source_id: source.source_id, source_name: source.name, request_url: apiUrl, status_code: response.status, response_body: data, error_message: data.error ? data.error.message : null });

        if (data.error) {
          console.error(`API Error for source ${source.source_id}:`, data.error.message);
          continue;
        }

        let postsArray = (data.data && Array.isArray(data.data.data)) ? data.data.data : (Array.isArray(data.data) ? data.data : null);
        if (!postsArray) continue;

        const postsToInsert = postsArray.filter((p: any) => p.message).map((p: any) => ({ user_id: source.user_id, source_id: source.source_id, source_name: source.name, post_id: p.id, content: p.message, post_url: p.permalink_url || `https://facebook.com/${p.id}`, created_time: p.created_time }));
        if (postsToInsert.length > 0) {
          const { error: insertError } = await supabaseAdmin.from('news_posts').insert(postsToInsert, { onConflict: 'user_id, post_id' });
          if (insertError) console.error(`DB Insert Error for source ${source.source_id}:`, insertError.message);
        }
      } catch (e) {
        await supabaseAdmin.from('news_scan_logs').insert({ user_id: source.user_id, source_id: source.source_id, source_name: source.name, request_url: apiUrl, status_code: 500, response_body: { error: "Function exception" }, error_message: e.message });
        console.error(`Failed to process source ${source.source_id}:`, e.message);
      }
    }
    return new Response(JSON.stringify({ success: true, message: "Scan completed." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});