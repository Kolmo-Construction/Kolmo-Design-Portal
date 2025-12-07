-- Create readonly user for AI agent
-- This user can only SELECT from tables, ensuring the AI cannot modify data

-- Create the user (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'kolmo_agent_readonly') THEN
    CREATE USER kolmo_agent_readonly WITH PASSWORD 'change_this_in_production';
  END IF;
END
$$;

-- Grant connect to database
GRANT CONNECT ON DATABASE postgres TO kolmo_agent_readonly;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO kolmo_agent_readonly;

-- Grant SELECT on all current tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO kolmo_agent_readonly;

-- Grant SELECT on all future tables (important for migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO kolmo_agent_readonly;

-- Grant usage on sequences (for reading next values, not modifying)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO kolmo_agent_readonly;

-- Comment explaining the user
COMMENT ON ROLE kolmo_agent_readonly IS 'Read-only user for AI agent to safely query database without modification capabilities';
