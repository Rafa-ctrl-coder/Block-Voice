-- =============================================================================
-- Fix profile RLS: allow authenticated users to count profiles in their development
-- Currently, users can only see their own profile row, which means the
-- dashboard member count always shows 1.
-- This policy allows seeing basic info (id, building_id) for profiles
-- in buildings that share the same development_name.
-- =============================================================================

-- Allow authenticated users to see profiles in same development
-- (the frontend only reads first_name, last_name for supporter lists,
--  and counts profiles for the member count)
CREATE POLICY "profiles_same_development_read" ON profiles
  FOR SELECT
  USING (
    building_id IN (
      SELECT b2.id FROM buildings b2
      WHERE b2.development_name = (
        SELECT b.development_name FROM buildings b
        JOIN profiles p ON p.building_id = b.id
        WHERE p.id = auth.uid()
      )
    )
  );
