// @ts-nocheck

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Xử lý CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Tạo Supabase client với context của người dùng đang đăng nhập
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Lấy thông tin người dùng
    const { data: { user } } = await userSupabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Kiểm tra xem người dùng có phải là admin không
    const { data: profile, error: profileError } = await userSupabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Not an admin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Nếu là admin, tạo service role client để lấy tất cả người dùng
    const serviceSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Lấy danh sách tất cả người dùng từ auth.users
    const { data: { users }, error: usersError } = await serviceSupabaseClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw usersError

    // Lấy tất cả hồ sơ từ public.profiles
    const { data: profiles, error: profilesError } = await serviceSupabaseClient
      .from('profiles')
      .select('*')
    if (profilesError) throw profilesError

    // Kết hợp dữ liệu người dùng và hồ sơ
    const combinedData = users.map(u => {
      const p = profiles.find(profile => profile.id === u.id)
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        first_name: p?.first_name || null,
        last_name: p?.last_name || null,
        role: p?.role || 'user',
        status: p?.status || 'pending',
      }
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


    return new Response(JSON.stringify(combinedData), {
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