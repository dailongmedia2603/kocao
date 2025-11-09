-- Add a UNIQUE constraint to the user_id column in the user_subscriptions table
-- This ensures that each user can only have one subscription at a time.
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);