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

    // Step 1: Find a queued task for this extension
    const { data: task, error: findError } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("assigned_extension_id", extensionId)
      .eq("status", "queued")
      .order("execution_order", { ascending: true })
      .limit(1)
      .single();

    // If no task is found, it's not an error, just return null
    if (findError || !task) {
      return new Response(JSON.stringify({ task: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: If it's an upload task, generate the signed URL
    let finalPayload = task.payload;
    if (task.type === 'UPLOAD_FILE') {
      if (!task.payload?.storagePath) {
        throw new Error(`Task ${task.id} is UPLOAD_FILE but has no storagePath in payload.`);
      }

      // This block is now a direct copy of the working logic from list-koc-files
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
      
      // Create a new payload object with the fresh URL
      finalPayload = {
        ...task.payload,
        fileUrl: signedUrl,
      };
    }

    // Step 3: Atomically update the task status to 'running' and save the new payload
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from("tasks")
      .update({ status: "running", payload: finalPayload })
      .eq("id", task.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating task status to running:", updateError);
      throw updateError;
    }

    // Step 4: Return the fully updated task to the extension
    return new Response(JSON.stringify({ task: updatedTask }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error in get-queued-task function:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});