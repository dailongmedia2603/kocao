export type ContentPlan = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  inputs: Record<string, any> | null;
  results: Record<string, any> | null;
  koc_id: string;
};

export type ContentPlanWithKoc = ContentPlan & {
  kocs: {
    name: string;
    avatar_url: string | null;
  } | null;
};