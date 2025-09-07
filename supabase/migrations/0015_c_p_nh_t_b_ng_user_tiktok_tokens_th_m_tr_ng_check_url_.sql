-- Alter user_tiktok_tokens table to add check_url
ALTER TABLE public.user_tiktok_tokens
ADD COLUMN check_url TEXT;

-- Add a comment for the new column
COMMENT ON COLUMN public.user_tiktok_tokens.check_url IS 'A custom URL for checking the token validity.';