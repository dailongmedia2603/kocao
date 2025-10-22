// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Create a client with the user's auth token to check their role
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await userSupabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile, error: profileError } = await userSupabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Forbidden: Not an admin')
    }

    // 2. If user is an admin, proceed with deletion using service role
    const { userIdToDelete } = await req.json()
    if (!userIdToDelete) throw new Error('User ID to delete is required.')

    // Cannot delete self
    if (userIdToDelete === user.id) {
      throw new Error("Admins cannot delete their own account.")
    }

    const serviceSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: deleteError } = await serviceSupabaseClient.auth.admin.deleteUser(userIdToDelete)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true, message: 'User deleted successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Unauthorized') ? 401 : error.message.includes('Forbidden') ? 403 : 500,
    })
  }
})