// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { format } from "https://deno.land/std@0.208.0/datetime/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: tasksToArchive, error: fetchError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('id, user_id, result_video_url, title, koc_id')
      .eq('is_archived', false)
      .like('result_video_url', '%aliyuncs.com%')
      .limit(5);

    if (fetchError) {
      throw new Error(`Lỗi khi tìm video cần lưu trữ: ${fetchError.message}`);
    }

    if (!tasksToArchive || tasksToArchive.length === 0) {
      return new Response(JSON.stringify({ message: "Không có video nào cần lưu trữ." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Tìm thấy ${tasksToArchive.length} video cần lưu trữ.`);
    let successCount = 0;
    let errorCount = 0;

    const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      throw new Error("Thiếu cấu hình biến môi trường cho R2.");
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    for (const task of tasksToArchive) {
      try {
        if (!task.koc_id) {
            throw new Error(`Task ${task.id} is not associated with a KOC. Cannot archive.`);
        }

        const { data: kocData, error: kocError } = await supabaseAdmin
            .from('kocs')
            .select('folder_path')
            .eq('id', task.koc_id)
            .single();
        if (kocError || !kocData?.folder_path) {
            throw new Error(`Could not find folder path for KOC ID ${task.koc_id}.`);
        }
        const kocFolderPath = kocData.folder_path;

        const videoResponse = await fetch(task.result_video_url);
        if (!videoResponse.ok) {
          throw new Error(`Không thể tải video từ URL tạm thời (status: ${videoResponse.status})`);
        }
        const videoBuffer = await videoResponse.arrayBuffer();
        const videoContentType = videoResponse.headers.get('content-type') || 'video/mp4';
        
        const fileExtension = videoContentType.split('/')[1] || 'mp4';
        const r2Key = `${kocFolderPath}/generated/dreamface-${task.id}.${fileExtension}`;
        const displayName = `${task.title || 'dreamface-video'}-${format(new Date(), 'yyyy-MM-dd')}.${fileExtension}`;

        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
          Body: new Uint8Array(videoBuffer),
          ContentType: videoContentType,
        }));

        const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`;

        // **THE FIX IS HERE: Add the video to the KOC's official library**
        const { error: kocFileError } = await supabaseAdmin
            .from('koc_files')
            .insert({
                koc_id: task.koc_id,
                user_id: task.user_id,
                r2_key: r2Key,
                display_name: displayName,
            });
        if (kocFileError) {
            console.error(`Failed to create koc_files record for task ${task.id}:`, kocFileError.message);
            throw new Error(`Failed to create koc_files record: ${kocFileError.message}`);
        }

        const { error: updateError } = await supabaseAdmin
          .from('dreamface_tasks')
          .update({
            result_video_url: publicUrl,
            is_archived: true,
            error_message: null,
          })
          .eq('id', task.id);

        if (updateError) {
          throw new Error(`Lỗi cập nhật CSDL sau khi lưu trữ: ${updateError.message}`);
        }
        
        console.log(`Lưu trữ thành công video cho task: ${task.id}`);
        successCount++;

      } catch (err) {
        console.error(`Lỗi khi xử lý task ${task.id}:`, err.message);
        await supabaseAdmin
          .from('dreamface_tasks')
          .update({ error_message: `Lỗi lưu trữ: ${err.message}` })
          .eq('id', task.id);
        errorCount++;
      }
    }

    const summary = `Hoàn tất. Lưu trữ thành công: ${successCount}. Thất bại: ${errorCount}.`;
    return new Response(JSON.stringify({ message: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Lỗi nghiêm trọng trong dreamface-archive-video:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});