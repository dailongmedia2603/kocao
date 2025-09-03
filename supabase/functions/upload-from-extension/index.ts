// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const formData = await req.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");
    const projectId = formData.get("projectId");
    const fileName = formData.get("fileName");

    if (!file || !userId || !projectId || !fileName) {
      throw new Error("Thiếu thông tin tệp, userId, projectId, hoặc fileName.");
    }

    // 1. Tải tệp lên Storage
    const storagePath = `${userId}/${projectId}/${Date.now()}-${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("user_files")
      .upload(storagePath, file, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Lỗi tải lên Storage:", uploadError);
      throw uploadError;
    }

    // 2. Lấy URL công khai của tệp
    const { data: urlData } = supabaseAdmin.storage
      .from("user_files")
      .getPublicUrl(storagePath);

    // 3. Lưu thông tin vào bảng user_files (Thư viện)
    const { error: dbError } = await supabaseAdmin.from("user_files").insert({
      user_id: userId,
      project_id: projectId,
      file_name: fileName,
      file_url: urlData.publicUrl,
      storage_path: storagePath,
      source: 'download', // Đánh dấu tệp này được tải xuống từ web
      storage_provider: 'supabase'
    });

    if (dbError) {
      console.error("Lỗi lưu vào DB:", dbError);
      // Nếu không lưu được vào DB, xóa tệp đã tải lên để tránh rác
      await supabaseAdmin.storage.from("user_files").remove([storagePath]);
      throw dbError;
    }

    return new Response(JSON.stringify({ success: true, message: `Tệp ${fileName} đã được tải lên.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lỗi trong Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});