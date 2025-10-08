// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Invalid or expired token.");

    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_dreamface_api_keys")
      .select("account_id, user_id_dreamface, token_id, client_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (apiKeyError || !apiKeyData) {
      throw new Error("Chưa có API Key Dreamface nào được cấu hình. Vui lòng thêm trong phần Cài đặt.");
    }

    const contentType = req.headers.get("content-type");
    let path: string, method: string, body: any;
    let videoFile: File | null = null, audioFile: File | null = null;

    if (contentType && contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        path = formData.get('path') as string;
        method = formData.get('method') as string;
        videoFile = formData.get('videoFile') as File;
        audioFile = formData.get('audioFile') as File;
        body = {};
    } else {
        ({ path, method, body } = await req.json());
    }

    if (!path || !method) {
        throw new Error("Path and method are required.");
    }

    const apiUrl = `https://dapi.qcv.vn/${path}`;
    let fetchOptions: RequestInit = { method };
    let finalUrl = apiUrl;

    if (method === 'GET') {
        const params = new URLSearchParams({
            accountId: apiKeyData.account_id,
            userId: apiKeyData.user_id_dreamface,
            tokenId: apiKeyData.token_id,
            clientId: apiKeyData.client_id,
            ...(body || {}),
        });
        finalUrl = `${apiUrl}?${params.toString()}`;
    } else if (method === 'POST') {
        if (path === 'upload-video') {
            const dreamfaceFormData = new FormData();
            dreamfaceFormData.append('accountId', apiKeyData.account_id);
            dreamfaceFormData.append('userId', apiKeyData.user_id_dreamface);
            dreamfaceFormData.append('tokenId', apiKeyData.token_id);
            dreamfaceFormData.append('clientId', apiKeyData.client_id);
            if (!videoFile) throw new Error("Video file is required for upload-video.");
            if (!audioFile) throw new Error("Audio file is required for upload-video.");
            dreamfaceFormData.append('file', videoFile);
            dreamfaceFormData.append('audio', audioFile);
            
            fetchOptions.body = dreamfaceFormData;
        } else {
            const params = new URLSearchParams({
                accountId: apiKeyData.account_id,
                userId: apiKeyData.user_id_dreamface,
                tokenId: apiKeyData.token_id,
                clientId: apiKeyData.client_id,
            });
            finalUrl = `${apiUrl}?${params.toString()}`;
            
            if (body && Object.keys(body).length > 0) {
                fetchOptions.headers = { 'Content-Type': 'application/json' };
                fetchOptions.body = JSON.stringify(body);
            }
        }
    }

    const apiResponse = await fetch(finalUrl, fetchOptions);
    
    const responseContentType = apiResponse.headers.get("content-type");
    if (responseContentType && responseContentType.includes("application/json")) {
        const responseData = await apiResponse.json();
        if (!apiResponse.ok) {
            throw new Error(responseData.message || JSON.stringify(responseData));
        }
        return new Response(JSON.stringify({ success: true, data: responseData }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`API Error ${apiResponse.status}: ${errorText}`);
        }
        const responseBody = await apiResponse.blob();
        return new Response(responseBody, { status: 200, headers: { ...corsHeaders, 'Content-Type': responseContentType || 'application/octet-stream' } });
    }

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});