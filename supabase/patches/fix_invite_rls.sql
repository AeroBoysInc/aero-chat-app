-- Patch: Allow any authenticated user to SELECT servers and server_roles
-- Needed so invite join flow can preview the server and find the default Member role.
-- Run this in the Supabase SQL Editor.

-- 1. servers: allow any authenticated user to read (name/icon/banner aren't sensitive)
DROP POLICY IF EXISTS "servers_member_select" ON public.servers;
CREATE POLICY "servers_authenticated_select" ON public.servers FOR SELECT
  TO authenticated
  USING (true);

-- 2. server_roles: allow any authenticated user to read (role names/colors aren't sensitive)
DROP POLICY IF EXISTS "roles_member_select" ON public.server_roles;
CREATE POLICY "roles_authenticated_select" ON public.server_roles FOR SELECT
  TO authenticated
  USING (true);
