UPDATE public.profiles
SET
  role = 'admin',
  status = 'active'
WHERE id = (SELECT id FROM auth.users WHERE email = 'huulong111@gmail.com');