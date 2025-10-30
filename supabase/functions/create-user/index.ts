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
    // 1. Verify the caller is an admin
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

    // 2. Get user details from the request body
    const { email, password, first_name, last_name } = await req.json()
    if (!email || !password || !first_name || !last_name) {
      throw new Error('Email, password, first name, and last name are required.')
    }

    // 3. Create the user using the service role client
    const serviceSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: newUser, error: createError } = await serviceSupabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // This skips the confirmation email
      user_metadata: {
        first_name: first_name,
        last_name: last_name,
      },
    })

    if (createError) {
      if (createError.message.includes('User already registered')) {
        throw new Error('Email này đã được sử dụng.');
      }
      if (createError.message.includes('Password should be at least 6 characters')) {
        throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
      }
      throw createError;
    }

    // The `handle_new_user` trigger should have already created the profile.
    // Let's set the status to 'active' since an admin is creating it.
    const { error: updateStatusError } = await serviceSupabaseClient
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', newUser.user.id);

    if (updateStatusError) {
      // Log this error but don't fail the whole request, as the user is already created.
      console.error(`Failed to set status to 'active' for new user ${newUser.user.id}:`, updateStatusError.message);
    }

    return new Response(JSON.stringify({ success: true, message: 'User created successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Unauthorized') ? 401 : error.message.includes('Forbidden') ? 403 : 400,
    })
  }
})