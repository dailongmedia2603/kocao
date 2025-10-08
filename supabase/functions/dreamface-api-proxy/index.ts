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

    const { path, method, body, isUrlEncoded } = await req.json();
    
    const params = new URLSearchParams({
      accountId: apiKeyData.account_id,
      userId: apiKeyData.user_id_dreamface,
      tokenId: apiKeyData.token_id,
      clientId: apiKeyData.client_id,
    });

    // Append additional params from body for GET requests
    if (method === 'GET' && body) {
        for (const key in body) {
            params.append(key, body[key]);
        }
    }

    const apiUrl = `https://dapi.qcv.vn/${path}?${params.toString()}`;
    
    let fetchBody;
    const headers = {};

    if (method === 'POST') {
        if (isUrlEncoded) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            const urlEncodedBody = new URLSearchParams();
            for (const key in body) {
                urlEncodedBody.append(key, body[key]);
            }
            fetchBody = urlEncodedBody;
        } else {
            // Default to JSON if not specified
            headers['Content-Type'] = 'application/json';
            fetchBody = JSON.stringify(body);
        }
    }

    const fetchOptions = {
      method: method,
      headers: headers,
      body: fetchBody,
    };

    const apiResponse = await fetch(apiUrl, fetchOptions);
    
    // Dreamface API might return non-JSON responses on success (e.g., file downloads)
    // or error messages as plain text.
    const contentType = apiResponse.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
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
        // For file downloads or other non-JSON success responses
        const responseBody = await apiResponse.blob();
        return new Response(responseBody, { status: 200, headers: { ...corsHeaders, 'Content-Type': contentType || 'application/octet-stream' } });
    }

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});