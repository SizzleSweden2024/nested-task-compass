/*
  # Remove RLS Policy from Tasks Table

  1. Changes
     - Disables row level security on the tasks table
     - Allows public access to the tasks table without authentication
  
  2. Security
     - This change removes security restrictions on the tasks table
     - All tasks will be publicly accessible
*/

-- Disable row level security on the tasks table
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;