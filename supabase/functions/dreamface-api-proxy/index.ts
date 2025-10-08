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
    let path: string, method: string, body: any, isUrlEncoded: boolean | undefined;
    let videoFile: File | null = null, audioFile: File | null = null;

    if (contentType && contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        path = formData.get('path') as string;
        method = formData.get('method') as string;
        videoFile = formData.get('videoFile') as File;
        audioFile = formData.get('audioFile') as File;
    } else {
        ({ path, method, body, isUrlEncoded } = await req.json());
    }

    if (!path || !method) {
        throw new Error("Path and method are required.");
    }

    const params = new URLSearchParams({
      accountId: apiKeyData.account_id,
      userId: apiKeyData.user_id_dreamface,
      tokenId: apiKeyData.token_id,
      clientId: apiKeyData.client_id,
    });

    let apiUrl = `https://dapi.qcv.vn/${path}`;
    let fetchBody: any;
    const headers: Record<string, string> = {};
    let finalUrl = apiUrl;

    if (method === 'POST' && path === 'upload-video') {
        finalUrl = `${apiUrl}?${params.toString()}`;
        
        const dreamfaceFormData = new FormData();
        if (videoFile) dreamfaceFormData.append('file', videoFile);
        if (audioFile) dreamfaceFormData.append('audio', audioFile);
        
        fetchBody = dreamfaceFormData;
        // Do not set Content-Type for FormData, fetch does it.
    } else if (method === 'POST') {
        finalUrl = `${apiUrl}?${params.toString()}`;
        if (isUrlEncoded) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            const urlEncodedBody = new URLSearchParams();
            for (const key in body) {
                urlEncodedBody.append(key, body[key]);
            }
            fetchBody = urlEncodedBody;
        } else {
            headers['Content-Type'] = 'application/json';
            fetchBody = JSON.stringify(body);
        }
    } else { // GET
        if (body) {
            for (const key in body) {
                params.append(key, body[key]);
            }
        }
        finalUrl = `${apiUrl}?${params.toString()}`;
    }

    const fetchOptions = {
      method: method,
      headers: headers,
      body: fetchBody,
    };

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