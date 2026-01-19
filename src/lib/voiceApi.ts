import { api } from "@/lib/apiClient";

interface CallVoiceApiProps {
  path: string;
  method: "GET" | "POST" | "DELETE";
  body?: Record<string, any>;
}

export const callVoiceApi = async ({ path, method, body }: CallVoiceApiProps) => {
  // Use the API client proxy method which calls the backend -> external voice API
  return api.voice.proxy({ path, method, body });
};