-- Drop the policies associated with the table first
DROP POLICY IF EXISTS "Users can view their own Vertex AI credentials" ON public.user_vertex_ai_credentials;
DROP POLICY IF EXISTS "Users can insert their own Vertex AI credentials" ON public.user_vertex_ai_credentials;
DROP POLICY IF EXISTS "Users can update their own Vertex AI credentials" ON public.user_vertex_ai_credentials;
DROP POLICY IF EXISTS "Users can delete their own Vertex AI credentials" ON public.user_vertex_ai_credentials;

-- Drop the table itself
DROP TABLE IF EXISTS public.user_vertex_ai_credentials;