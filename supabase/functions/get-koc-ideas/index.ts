// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { kocId } = await req.json();
    if (!kocId) {
      throw new Error("Thiếu kocId.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_PUBLIC_URL) {
        throw new Error("Thiếu cấu hình R2_PUBLIC_URL.");
    }

    const { data: ideas, error } = await supabaseAdmin
      .from("koc_content_ideas")
      .select("*, koc_files(display_name, r2_key)")
      .eq("koc_id", kocId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Augment data with full URL
    const ideasWithUrls = ideas.map(idea => {
      if (idea.koc_files && idea.koc_files.r2_key) {
        return {
          ...idea,
          koc_files: {
            ...idea.koc_files,
            url: `${R2_PUBLIC_URL}/${idea.koc_files.r2_key}`
          }
        };
      }
      return idea;
    });

    return new Response(JSON.stringify({ data: ideasWithUrls }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong get-koc-ideas:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});