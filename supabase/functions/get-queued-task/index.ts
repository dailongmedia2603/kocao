// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { extensionId } = await req.json();
    if (!extensionId) {
      throw new Error("Thiếu extensionId.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find a queued task for this extension
    const { data: task, error: findError } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("assigned_extension_id", extensionId)
      .eq("status", "queued")
      .order("execution_order", { ascending: true })
      .limit(1)
      .single();

    if (findError || !task) {
      return new Response(JSON.stringify({ task: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If the task is an UPLOAD_FILE task, generate a fresh signed URL
    if (task.type === 'UPLOAD_FILE' && task.payload?.storagePath) {
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
          secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
        },
      });

      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: Deno.env.get("R2_BUCKET_NAME"),
          Key: task.payload.storagePath,
        }),
        { expiresIn: 300 } // URL is valid for 5 minutes
      );
      
      // Add the fresh URL to the payload
      task.payload.fileUrl = signedUrl;
    }

    // Lock the task by updating its status to 'running' and saving the new payload
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from("tasks")
      .update({ status: "running", payload: task.payload })
      .eq("id", task.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Return the updated task to the extension
    return new Response(JSON.stringify({ task: updatedTask }), {
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