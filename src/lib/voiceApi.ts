import { supabase } from "@/integrations/supabase/client";

type ProxyRequest = {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, any>;
}

export const callVoiceApi = async ({ path, method, body }: ProxyRequest) => {
  const { data, error } = await supabase.functions.invoke("voice-api-proxy", {
    body: { path, method, body },
  });

  if (error) {
    throw new Error(`Lỗi gọi function: ${error.message}`);
  }

  if (data.error) {
    throw new Error(data.error);
  }
  
  if (data.message && Object.keys(data).length === 1) {
     // Handle cases where the API returns a simple message on error
     throw new Error(data.message);
  }

  return data;
};