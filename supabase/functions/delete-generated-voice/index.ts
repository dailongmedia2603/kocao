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

    const { historyId } = await req.json();
    if (!historyId) throw new Error("Thiếu ID lịch sử.");

    const { data: history, error: fetchError } = await supabaseAdmin.from("voice_generation_history").select("storage_path").eq("id", historyId).eq("user_id", user.id).single();
    if (fetchError || !history) throw new Error("Không tìm thấy bản ghi hoặc không có quyền truy cập.");

    const { error: storageError } = await supabaseAdmin.storage.from("voice_generations").remove([history.storage_path]);
    if (storageError) console.error("Lỗi xóa file khỏi storage:", storageError.message); // Log error but continue

    const { error: dbError } = await supabaseAdmin.from("voice_generation_history").delete().eq("id", historyId);
    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});