// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const logPayload = { user_id: null, action: 'delete-task', request_payload: null, response_body: null, status_code: 200, error_message: null };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");
    logPayload.user_id = user.id;

    const { taskId } = await req.json();
    if (!taskId) throw new Error("Task ID is required.");
    logPayload.dreamface_task_id = taskId;
    logPayload.request_payload = { taskId };

    // 1. Fetch task details to get the R2 key
    const { data: taskData, error: fetchError } = await supabaseAdmin
      .from('dreamface_tasks')
      .select('result_video_url')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "not found" error, maybe already deleted
        throw fetchError;
    }

    // 2. Delete the database record immediately
    const { error: deleteDbError } = await supabaseAdmin
      .from('dreamface_tasks')
      .delete()
      .eq('id', taskId);

    if (deleteDbError) {
      throw new Error(`DB delete error: ${deleteDbError.message}`);
    }

    // 3. If the file exists and is on R2, delete it in the background
    if (taskData?.result_video_url && taskData.result_video_url.includes(Deno.env.get("R2_PUBLIC_URL"))) {
      const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
      const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
      const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
      const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");

      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      });

      const r2Key = taskData.result_video_url.replace(`${Deno.env.get("R2_PUBLIC_URL")}/`, '');
      
      // Don't await this, let it run in the background
      s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key }))
        .then(() => console.log(`Successfully deleted ${r2Key} from R2 for task ${taskId}.`))
        .catch(err => console.error(`Background R2 delete failed for task ${taskId}:`, err.message));
    }

    const responseData = { success: true, message: "Task deletion initiated." };
    logPayload.response_body = responseData;
    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[dreamface-delete-task] CRITICAL ERROR:`, error.message);
    logPayload.error_message = error.message;
    logPayload.status_code = 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    await supabaseAdmin.from('dreamface_logs').insert(logPayload);
  }
});