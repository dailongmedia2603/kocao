// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

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
    // 1. Tìm các video cần được lưu trữ (chưa được archived và có link tạm thời)
    const { data: tasksToArchive, error: fetchError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('id, user_id, result_video_url, title')
      .eq('is_archived', false)
      .like('result_video_url', '%aliyuncs.com%')
      .limit(5); // Xử lý 5 video mỗi lần chạy để tránh timeout

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

    // Lấy thông tin R2 từ biến môi trường
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

    // 2. Xử lý từng video
    for (const task of tasksToArchive) {
      try {
        // Tải video từ URL tạm thời
        const videoResponse = await fetch(task.result_video_url);
        if (!videoResponse.ok) {
          throw new Error(`Không thể tải video từ URL tạm thời (status: ${videoResponse.status})`);
        }
        const videoBuffer = await videoResponse.arrayBuffer();
        const videoContentType = videoResponse.headers.get('content-type') || 'video/mp4';
        
        // Tạo đường dẫn và tên file trên R2
        const fileExtension = videoContentType.split('/')[1] || 'mp4';
        const storagePath = `dreamface/${task.user_id}/${task.id}.${fileExtension}`;

        // Tải video lên R2
        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: storagePath,
          Body: new Uint8Array(videoBuffer),
          ContentType: videoContentType,
        }));

        const publicUrl = `${R2_PUBLIC_URL}/${storagePath}`;

        // Cập nhật lại CSDL với link R2 và đánh dấu đã lưu trữ
        const { error: updateError } = await supabaseAdmin
          .from('dreamface_tasks')
          .update({
            result_video_url: publicUrl,
            is_archived: true,
            error_message: null, // Xóa lỗi cũ nếu có
          })
          .eq('id', task.id);

        if (updateError) {
          throw new Error(`Lỗi cập nhật CSDL sau khi lưu trữ: ${updateError.message}`);
        }
        
        console.log(`Lưu trữ thành công video cho task: ${task.id}`);
        successCount++;

      } catch (err) {
        console.error(`Lỗi khi xử lý task ${task.id}:`, err.message);
        // Nếu có lỗi, cập nhật CSDL với thông báo lỗi
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