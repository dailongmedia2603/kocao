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

    // Lấy các video nguồn của KOC
    const { data: files, error: dbError } = await supabaseAdmin
      .from('koc_files')
      .select('id, display_name, r2_key, thumbnail_url, created_at')
      .eq('koc_id', kocId)
      .like('r2_key', '%/sources/videos/%')
      .order('created_at', { ascending: false });

    if (dbError) {
      throw new Error(`Lỗi truy vấn CSDL: ${dbError.message}`);
    }

    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_PUBLIC_URL) {
        throw new Error("Thiếu cấu hình R2_PUBLIC_URL.");
    }

    // Tạo public URL cho mỗi video
    const filesWithUrls = files.map((file) => {
      // Sửa lỗi: Loại bỏ dấu gạch chéo thừa để tránh URL bị sai
      return {
        ...file,
        url: `https://${R2_PUBLIC_URL}${file.r2_key}`,
      };
    });

    return new Response(JSON.stringify({ data: filesWithUrls }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong get-koc-videos:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});