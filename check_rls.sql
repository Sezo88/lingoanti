-- Check RLS policies on rooms table
SELECT * FROM pg_policies WHERE tablename = 'rooms';
