// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: req.headers.get("Authorization") } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Không tìm thấy người dùng.");

    const { data: creds, error: credsError } = await supabase.from("user_minimax_credentials").select("group_id, api_key").eq("user_id", user.id).limit(1).single();
    if (credsError || !creds) throw new Error("Chưa cấu hình API Minimax. Vui lòng thêm trong Cài đặt.");

    const response = await fetch(`https://api.minimax.chat/v1/text_to_speech/voices?GroupId=${creds.group_id}`, {
      headers: { "Authorization": `Bearer ${creds.api_key}` }
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.base_resp?.status_msg || "Lỗi khi lấy danh sách giọng nói.");

    return new Response(JSON.stringify(data.voices), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});