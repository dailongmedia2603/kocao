// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SpeechClient } from "npm:@google-cloud/speech@^6.3.0";
import { Storage } from "npm:@google-cloud/storage@^7.11.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { taskId } = await req.json();
    if (!taskId) throw new Error("Task ID is required.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get task details from Supabase
    const { data: task, error: taskError } = await supabaseAdmin
      .from('transcription_tasks')
      .select('video_storage_path')
      .eq('id', taskId)
      .single();

    if (taskError) throw new Error(`Failed to fetch task: ${taskError.message}`);

    // Download video from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('video-uploads')
      .download(task.video_storage_path);

    if (downloadError) throw new Error(`Failed to download video: ${downloadError.message}`);
    
    // Await the buffer here
    const videoBuffer = await fileData.arrayBuffer();

    // Configure Google Cloud clients
    const gcsBucketName = Deno.env.get("GCS_BUCKET_NAME");
    if (!gcsBucketName) throw new Error("GCS_BUCKET_NAME environment variable not set.");
    
    const credentials = JSON.parse(Deno.env.get("GOOGLE_CREDENTIALS_JSON")!);
    const gcs = new Storage({ credentials });
    const speech = new SpeechClient({ credentials });

    // Upload video to Google Cloud Storage
    const gcsFileName = `videos/${task.video_storage_path}`;
    const bucket = gcs.bucket(gcsBucketName);
    const file = bucket.file(gcsFileName);

    const stream = file.createWriteStream({
      metadata: { contentType: fileData.type },
    });

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
      // Pass the already-awaited buffer
      stream.end(new Uint8Array(videoBuffer));
    });

    // Start transcription job
    const gcsUri = `gs://${gcsBucketName}/${gcsFileName}`;
    const [operation] = await speech.longRunningRecognize({
      config: {
        // Assuming MP4, adjust if needed. For best results, specify the encoding if known.
        // For MP4, Google often infers it, but being explicit can help.
        // If you face issues, you might need a function to map file extension to encoding.
        languageCode: 'vi-VN',
        enableAutomaticPunctuation: true,
      },
      audio: { uri: gcsUri },
    });

    // Update task with Google's operation name
    const { error: updateError } = await supabaseAdmin
      .from('transcription_tasks')
      .update({ status: 'processing', google_operation_name: operation.name })
      .eq('id', taskId);

    if (updateError) throw new Error(`Failed to update task status: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, message: "Transcription started." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in start-transcription:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});