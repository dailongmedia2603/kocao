// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@^3.609.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.609.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();
    if (!campaignId) {
      throw new Error("Campaign ID is required.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: activities, error } = await supabaseAdmin.rpc('get_campaign_activity_log', { p_campaign_id: campaignId });
    if (error) throw error;
    if (!activities) {
        return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
        secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
      },
    });
    const bucket = Deno.env.get("R2_BUCKET_NAME");

    const processedActivities = await Promise.all(
      activities.map(async (activity) => {
        if (activity.video_file_id) {
          const { data: fileData, error: fileError } = await supabaseAdmin
            .from('koc_files')
            .select('r2_key')
            .eq('id', activity.video_file_id)
            .single();
          
          if (fileData && fileData.r2_key) {
            const presignedUrl = await getSignedUrl(
              s3,
              new GetObjectCommand({ Bucket: bucket, Key: fileData.r2_key }),
              { expiresIn: 3600 } // 1 hour
            );
            return { ...activity, video_url: presignedUrl };
          }
        }
        return activity;
      })
    );

    return new Response(JSON.stringify(processedActivities), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-campaign-activity-log-edge:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});