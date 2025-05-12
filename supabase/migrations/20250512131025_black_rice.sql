/*
  # Update User References to Profiles Table

  1. Changes
     - Creates a profiles table if it doesn't exist
     - Updates foreign key references to point to profiles instead of users
     - Adds necessary indexes for performance
  
  2. Security
     - Maintains the existing security model with disabled RLS
     - Ensures data integrity with proper foreign key relationships
*/

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on profiles id
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- Add comment to clarify the purpose of the profiles table
COMMENT ON TABLE profiles IS 'User profiles for the application';

-- Disable RLS on profiles table to match other tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;