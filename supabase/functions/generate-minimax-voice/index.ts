// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const authHeader = req.headers.get("Authorization");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Không tìm thấy người dùng.");

    const { data: creds, error: credsError } = await supabaseAdmin.from("user_minimax_credentials").select("group_id, api_key").eq("user_id", user.id).limit(1).single();
    if (credsError || !creds) throw new Error("Chưa cấu hình API Minimax.");

    const { text, voice_id, model, speed, vol, pitch } = await req.json();

    const apiResponse = await fetch(`https://api.minimax.chat/v1/text_to_speech/pro?GroupId=${creds.group_id}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${creds.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_id, model, speed, vol, pitch }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.base_resp?.status_msg || "Lỗi từ API Minimax.");
    }

    const audioBuffer = await apiResponse.arrayBuffer();
    const filePath = `${user.id}/${Date.now()}.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage.from("voice_generations").upload(filePath, audioBuffer, { contentType: 'audio/mpeg' });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from("voice_generations").getPublicUrl(filePath);

    const { data: historyEntry, error: dbError } = await supabaseAdmin.from("voice_generation_history").insert({
      user_id: user.id, text, voice_id, model, storage_path: filePath, file_url: publicUrl,
    }).select().single();
    if (dbError) throw dbError;

    return new Response(JSON.stringify(historyEntry), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});