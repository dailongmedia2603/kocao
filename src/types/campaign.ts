export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  kocs: {
    name: string;
    avatar_url: string | null;
  } | null;
  cloned_voice_name: string | null;
  ai_prompt: string | null;
};