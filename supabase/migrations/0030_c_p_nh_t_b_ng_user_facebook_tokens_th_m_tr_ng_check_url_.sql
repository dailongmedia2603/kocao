-- Add check_url column to user_facebook_tokens table
ALTER TABLE public.user_facebook_tokens
ADD COLUMN check_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.user_facebook_tokens.check_url IS 'The URL to use for validating the access token.';