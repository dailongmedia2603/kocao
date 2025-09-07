// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

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
    const { fileIds } = await req.json();
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error("Thiếu danh sách fileIds.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Lấy R2 keys từ DB trước
    const { data: filesData, error: fetchError } = await supabaseAdmin
      .from("koc_files")
      .select("r2_key")
      .in("id", fileIds);

    if (fetchError) throw new Error(`Lỗi lấy thông tin tệp: ${fetchError.message}`);

    // 2. Xóa các bản ghi trong DB ngay lập tức (thao tác nhanh)
    const { error: deleteDbError } = await supabaseAdmin
      .from("koc_files")
      .delete()
      .in("id", fileIds);

    if (deleteDbError) throw new Error(`Lỗi xóa DB: ${deleteDbError.message}`);

    // 3. Bắt đầu xóa các tệp trên R2 trong nền (không cần await)
    if (filesData && filesData.length > 0) {
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
          secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
        },
      });
      const bucket = Deno.env.get("R2_BUCKET_NAME");
      const deleteParams = {
        Bucket: bucket,
        Delete: { Objects: filesData.map(({ r2_key }) => ({ Key: r2_key })) },
      };
      // Không `await` ở đây để trả về phản hồi ngay lập tức
      s3.send(new DeleteObjectsCommand(deleteParams)).catch(err => {
        console.error("Lỗi xóa R2 trong nền:", err);
      });
    }

    // 4. Trả về thành công ngay lập tức
    return new Response(JSON.stringify({ success: true, message: `Đã bắt đầu xóa ${fileIds.length} tệp.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});