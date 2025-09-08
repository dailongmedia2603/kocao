// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: allSources, error: sourcesError } = await supabaseAdmin
      .from('news_sources')
      .select('user_id, source_id, name');
    
    if (sourcesError) throw sourcesError;

    const sourcesByUser = allSources.reduce((acc: any, source: any) => {
      acc[source.user_id] = acc[source.user_id] || [];
      acc[source.user_id].push(source);
      return acc;
    }, {});

    const { data: allTokens, error: tokensError } = await supabaseAdmin
      .from('user_facebook_tokens')
      .select('user_id, access_token');
    if (tokensError) throw tokensError;
    const tokenMap = new Map(allTokens.map((t: any) => [t.user_id, t.access_token]));

    for (const userId in sourcesByUser) {
      const userSources = sourcesByUser[userId];
      const accessToken = tokenMap.get(userId);

      if (!accessToken) {
        console.warn(`Skipping user ${userId}: No Facebook token found.`);
        continue;
      }

      for (const source of userSources) {
        const apiUrl = `https://api.akng.io.vn/graph/${source.source_id}/feed?access_token=${accessToken}&limit=10`;
        try {
          const response = await fetch(apiUrl);
          const data = await response.json();

          await supabaseAdmin.from('news_scan_logs').insert({
            user_id: userId,
            source_id: source.source_id,
            source_name: source.name,
            request_url: apiUrl,
            status_code: response.status,
            response_body: data,
            error_message: data.error ? data.error.message : null
          });

          if (data.error) {
            console.error(`API Error for source ${source.source_id} (User: ${userId}):`, data.error.message);
            continue;
          }

          if (!data.data) continue;

          const postsToInsert = data.data
            .filter((post: any) => post.message)
            .map((post: any) => ({
              user_id: userId,
              source_id: source.source_id,
              source_name: source.name,
              post_id: post.id,
              content: post.message,
              post_url: post.actions?.find((a:any) => a.name === "Comment")?.link || `https://facebook.com/${post.id}`,
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
            user_id: userId,
            source_id: source.source_id,
            source_name: source.name,
            request_url: apiUrl,
            status_code: 500,
            response_body: { error: "Function exception" },
            error_message: e.message
          });
          console.error(`Failed to process source ${source.source_id} for user ${userId}:`, e.message);
        }
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