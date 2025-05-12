/*
  # Remove All Foreign Key Constraints and Disable RLS

  1. Changes
     - Drops all foreign key constraints on user_id columns
     - Disables row level security on all tables
     - Ensures public access to all tables without authentication
  
  2. Security
     - This change removes security restrictions on all tables
     - All data will be publicly accessible
*/

-- Drop foreign key constraints that reference the non-existent users table
ALTER TABLE IF EXISTS tasks
DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;

ALTER TABLE IF EXISTS projects
DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE IF EXISTS time_blocks
DROP CONSTRAINT IF EXISTS time_blocks_user_id_fkey;

ALTER TABLE IF EXISTS time_trackings
DROP CONSTRAINT IF EXISTS time_trackings_user_id_fkey;

-- Disable RLS on all tables to ensure public access
ALTER TABLE IF EXISTS tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_trackings DISABLE ROW LEVEL SECURITY;