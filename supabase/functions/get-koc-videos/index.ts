/// <reference types="https://unpkg.com/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { kocId } = await req.json();
    if (!kocId) {
      return new Response(JSON.stringify({ error: 'kocId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Service role client to bypass RLS for internal check if needed, but we'll use user context for security
    const { data: files, error } = await supabaseClient
      .from('koc_files')
      .select('id, r2_key, display_name')
      .eq('koc_id', kocId)
      .eq('user_id', user.id) // Ensure user can only access their own KOC's files
      .like('r2_key', '%/source/%')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const r2PublicUrl = Deno.env.get('R2_PUBLIC_URL');
    if (!r2PublicUrl) {
      // Fallback or error if the env var is not set
      console.error('R2_PUBLIC_URL environment variable is not set.');
      throw new Error('Server configuration error: R2 public URL is missing.');
    }

    const filesWithUrls = files.map(file => ({
      ...file,
      url: `${r2PublicUrl}/${file.r2_key}`
    }));

    return new Response(JSON.stringify({ data: filesWithUrls }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})