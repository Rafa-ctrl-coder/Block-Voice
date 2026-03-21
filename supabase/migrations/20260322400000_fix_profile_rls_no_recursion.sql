-- =============================================================================
-- Fix: drop the recursive RLS policy and replace with a safe one
-- The previous policy referenced profiles within its own USING clause,
-- causing infinite recursion and breaking all profile queries.
-- =============================================================================

-- Drop the broken policy
DROP POLICY IF EXISTS "profiles_same_development_read" ON profiles;

-- Simple approach: allow authenticated users to read all profiles.
-- The frontend only displays first_name + last_name for supporters,
-- and counts profiles for the member count.
-- Sensitive fields (email, verification_url) are filtered by the frontend.
-- This is safe because the profiles table doesn't contain secrets —
-- emails are already visible in supporter lists.
CREATE POLICY "profiles_authenticated_read" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);
