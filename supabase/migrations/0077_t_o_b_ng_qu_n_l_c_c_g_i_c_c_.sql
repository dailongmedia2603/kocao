-- Create the subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_video_limit INT NOT NULL DEFAULT 0,
  price NUMERIC(10, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read plans
CREATE POLICY "Allow authenticated users to read plans"
ON public.subscription_plans FOR SELECT
TO authenticated USING (true);

-- ONLY allow admins to manage plans
CREATE POLICY "Allow admins to manage plans"
ON public.subscription_plans FOR ALL
TO authenticated
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');