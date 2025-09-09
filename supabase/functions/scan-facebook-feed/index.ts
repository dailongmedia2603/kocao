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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessToken = Deno.env.get("SHARED_FACEBOOK_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("SHARED_FACEBOOK_ACCESS_TOKEN chưa được cấu hình trong Supabase Secrets.");
    }

    const body = await req.json().catch(() => ({}));
    const specificUserId = body.userId;
    const sourceIdsToScan = body.sourceIds;

    let sourcesQuery = supabaseAdmin.from('news_sources').select('user_id, source_id, name');
    if (specificUserId) {
      sourcesQuery = sourcesQuery.eq('user_id', specificUserId);
    }
    if (sourceIdsToScan && Array.isArray(sourceIdsToScan) && sourceIdsToScan.length > 0) {
      sourcesQuery = sourcesQuery.in('source_id', sourceIdsToScan);
    }

    const { data: allSources, error: sourcesError } = await sourcesQuery;
    if (sourcesError) throw sourcesError;

    if (!allSources || allSources.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Không có nguồn tin tức nào được chọn để quét." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const source of allSources) {
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

        await supabaseAdmin.from('news_scan_logs').insert({
          user_id: source.user_id,
          source_id: source.source_id,
          source_name: source.name,
          request_url: apiUrl,
          status_code: response.status,
          response_body: data,
          error_message: data.error ? data.error.message : null
        });

        if (data.error) {
          console.error(`API Error for source ${source.source_id} (User: ${source.user_id}):`, data.error.message);
          continue;
        }

        let postsArray = null;
        if (data.data && Array.isArray(data.data.data)) {
          postsArray = data.data.data;
        } else if (Array.isArray(data.data)) {
          postsArray = data.data;
        }

        if (!postsArray) {
          console.warn(`No data array in response for source ${source.source_id}. Skipping.`);
          continue;
        }

        const postsToInsert = postsArray
          .filter((post: any) => post.message)
          .map((post: any) => ({
            user_id: source.user_id,
            source_id: source.source_id,
            source_name: source.name,
            post_id: post.id,
            content: post.message,
            post_url: post.permalink_url || `https://facebook.com/${post.id}`,
            created_time: post.created_time,
          }));

        if (postsToInsert.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('news_posts')
            .insert(postsToInsert, { onConflict: 'user_id, post_id' });
          
          if (insertError) {
            console.error(`DB Insert Error for source ${source.source_id}:`, insertError.message);
          }
        }
      } catch (e) {
        await supabaseAdmin.from('news_scan_logs').insert({
          user_id: source.user_id,
          source_id: source.source_id,
          source_name: source.name,
          request_url: apiUrl,
          status_code: 500,
          response_body: { error: "Function exception" },
          error_message: e.message
        });
        console.error(`Failed to process source ${source.source_id} for user ${source.user_id}:`, e.message);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Scan completed." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});