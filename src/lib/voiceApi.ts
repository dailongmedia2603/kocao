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

  // The Edge function returns a JSON body with an `error` key even on non-2xx responses.
  // Prioritize this specific message.
  if (data?.error) {
    throw new Error(data.error);
  }

  // Fallback to the generic invoke error if there's no specific message.
  if (error) {
    throw new Error(`Lỗi Edge Function: ${error.message}`);
  }

  return data;
};