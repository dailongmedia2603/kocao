import { supabase } from "@/integrations/supabase/client";

interface CallVoiceApiProps {
  path: string;
  method: "GET" | "POST" | "DELETE";
  body?: Record<string, any>;
}

export const callVoiceApi = async ({ path, method, body }: CallVoiceApiProps) => {
  const { data, error } = await supabase.functions.invoke("voice-api-proxy", {
    body: { path, method, body },
  });

  if (error) {
    throw new Error(`Lỗi Edge Function: ${error.message}`);
  }
  if (data.error) {
    throw new Error(`Lỗi API: ${data.error}`);
  }
  return data;
};