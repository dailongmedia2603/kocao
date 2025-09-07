// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

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
      throw new Error("Thiếu KOC ID.");
    }

    // Sử dụng service role key để có toàn quyền
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Lấy thông tin KOC (folder_path, avatar_url) trước khi xóa
    const { data: kocData, error: fetchError } = await supabaseAdmin
      .from("kocs")
      .select("folder_path, avatar_url")
      .eq("id", kocId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // Lỗi "No rows found"
        return new Response(JSON.stringify({ success: true, message: "KOC không tồn tại, có thể đã được xóa." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Lỗi lấy thông tin KOC: ${fetchError.message}`);
    }

    // 2. Xóa thư mục trên Cloudflare R2 nếu có
    if (kocData.folder_path) {
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
          secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
        },
      });
      const bucket = Deno.env.get("R2_BUCKET_NAME");

      const listCommand = new ListObjectsV2Command({ Bucket: bucket, Prefix: kocData.folder_path });
      const listedObjects = await s3.send(listCommand);

      if (listedObjects.Contents && listedObjects.Contents.length > 0) {
        const deleteParams = {
          Bucket: bucket,
          Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
        };
        await s3.send(new DeleteObjectsCommand(deleteParams));
      }
    }

    // 3. Xóa ảnh đại diện trên Supabase Storage nếu có
    if (kocData.avatar_url) {
        const filePath = kocData.avatar_url.split('/koc_avatars/').pop();
        if (filePath) {
            await supabaseAdmin.storage.from('koc_avatars').remove([filePath]);
        }
    }

    // 4. Xóa bản ghi KOC trong cơ sở dữ liệu
    const { error: deleteDbError } = await supabaseAdmin
      .from("kocs")
      .delete()
      .eq("id", kocId);

    if (deleteDbError) {
      throw new Error(`Lỗi xóa KOC khỏi cơ sở dữ liệu: ${deleteDbError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Xóa KOC và các tệp liên quan thành công." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Lỗi trong Edge Function delete-koc:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});