-- Add role column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Create enum-like check constraint for security
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin'));

-- Index for faster role lookups
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

-- Set Sezgin as Super Admin (ID found from logs)
UPDATE public.users 
SET role = 'super_admin' 
WHERE id = '96f6dd3f-d188-448d-95e6-5f92ac7d9d6f';

-- RLS Policies for Admin Access
-- Only admins can see other users' roles/data in admin views (this depends on how you structure admin queries)
-- For now, we rely on the application layer check, but let's ensure the column is accessible to the user themselves

-- Allow users to read their own role
CREATE POLICY "Users can read own role" 
ON public.users
FOR SELECT 
USING (auth.uid() = id);

-- Allow admins to read all roles (you might need to adjust existing select policies)
-- Assuming there's already a "Users can read public data" policy, we might need to be careful not to expose role publicy if it's sensitive.
-- But usually, knowing someone is an admin isn't critical. 
-- Let's stick to the column addition and initial data for now.
