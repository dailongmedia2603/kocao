// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to call the voice API proxy
const callVoiceApi = async (supabaseAdmin, { path, method, userId }) => {
  const { data, error } = await supabaseAdmin.functions.invoke("voice-api-proxy", {
    body: { path, method, userId },
  });
  if (error) throw new Error(data?.error || error.message);
  if (data.success === false) throw new Error(data.error || "API call failed without a specific message.");
  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get voices from our DB that are pending a sample
    const { data: pendingVoices, error: fetchError } = await supabaseAdmin
      .from('cloned_voices')
      .select('voice_id, user_id')
      .is('sample_audio', null);

    if (fetchError) throw new Error(`Error fetching pending voices: ${fetchError.message}`);
    if (!pendingVoices || pendingVoices.length === 0) {
      return new Response(JSON.stringify({ message: "No pending voices to sync." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingVoices.length} voices to sync.`);

    // 2. Get all voices from the external API for each unique user
    const userIds = [...new Set(pendingVoices.map(v => v.user_id))];
    const allApiVoices = new Map();

    for (const userId of userIds) {
        try {
            const apiResponse = await callVoiceApi(supabaseAdmin, {
                path: "v1m/voice/clone",
                method: "GET",
                userId: userId,
            });
            if (apiResponse.data && Array.isArray(apiResponse.data)) {
                apiResponse.data.forEach(voice => {
                    if (voice.voice_id) {
                        allApiVoices.set(voice.voice_id, voice);
                    }
                });
            }
        } catch (userApiError) {
            console.error(`Failed to fetch voices from API for user ${userId}:`, userApiError.message);
        }
    }

    let successCount = 0;
    let errorCount = 0;

    // 3. Compare and update
    for (const dbVoice of pendingVoices) {
      const apiVoice = allApiVoices.get(dbVoice.voice_id);

      if (apiVoice && apiVoice.sample_audio && apiVoice.sample_audio.startsWith('http')) {
        const { error: updateError } = await supabaseAdmin
          .from('cloned_voices')
          .update({ 
              sample_audio: apiVoice.sample_audio,
              cover_url: apiVoice.cover_url // Also update cover_url if it changed
          })
          .eq('voice_id', dbVoice.voice_id);

        if (updateError) {
          console.error(`Failed to update voice ${dbVoice.voice_id} in DB:`, updateError.message);
          errorCount++;
        } else {
          console.log(`Synced voice ${dbVoice.voice_id} with new sample URL.`);
          successCount++;
        }
      }
    }

    const summary = `Sync complete. Successfully updated: ${successCount}. Failed: ${errorCount}.`;
    return new Response(JSON.stringify({ message: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Critical error in sync-cloned-voices function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});