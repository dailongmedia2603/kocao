-- Create the kocs table
CREATE TABLE public.kocs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  field TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.kocs ENABLE ROW LEVEL SECURITY;

-- Create policies for secure data access
CREATE POLICY "Users can view their own KOCs" ON public.kocs
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own KOCs" ON public.kocs
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own KOCs" ON public.kocs
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own KOCs" ON public.kocs
FOR DELETE TO authenticated USING (auth.uid() = user_id);