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

    if (findError || !task) {
      return new Response(JSON.stringify({ task: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Lock the task by updating its status to 'running' first.
    // This prevents other workers from picking up the same task.
    const { data: lockedTask, error: lockError } = await supabaseAdmin
      .from("tasks")
      .update({ status: "running" })
      .eq("id", task.id)
      .select()
      .single();

    if (lockError) {
      console.error("Error locking task:", lockError);
      throw lockError;
    }

    // Step 3: If it's an upload task, generate the signed URL and enrich the payload.
    let finalTask = lockedTask;
    if (lockedTask.type === 'UPLOAD_FILE' && lockedTask.payload?.storagePath) {
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
          Key: lockedTask.payload.storagePath,
        }),
        { expiresIn: 300 } // URL is valid for 5 minutes
      );
      
      const enrichedPayload = {
        ...lockedTask.payload,
        fileUrl: signedUrl,
      };

      // Step 4: Update the task a second time with the enriched payload.
      const { data: updatedTaskWithUrl, error: payloadUpdateError } = await supabaseAdmin
        .from("tasks")
        .update({ payload: enrichedPayload })
        .eq("id", lockedTask.id)
        .select()
        .single();

      if (payloadUpdateError) {
        console.error("Error updating payload with signed URL:", payloadUpdateError);
        // Attempt to revert status to 'queued' on failure
        await supabaseAdmin.from("tasks").update({ status: "queued" }).eq("id", lockedTask.id);
        throw payloadUpdateError;
      }
      finalTask = updatedTaskWithUrl;
    }

    // Step 5: Return the fully prepared task to the extension.
    return new Response(JSON.stringify({ task: finalTask }), {
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