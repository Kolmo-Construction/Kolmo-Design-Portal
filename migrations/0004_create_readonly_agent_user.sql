-- Create readonly user for AI agent
-- This user can only SELECT from tables, ensuring the AI cannot modify data
-- Password must match AGENT_DB_PASSWORD environment variable

-- Drop user if exists (to allow password updates)
DROP USER IF EXISTS kolmo_agent_readonly;

-- Create the user with password
-- Note: Update this password to match your AGENT_DB_PASSWORD env var
-- For security, the actual password is: grP0TNu0nGRDxUc9/Flhwo+Lj2z6P/UGJ0QN25c2gXc=
CREATE USER kolmo_agent_readonly WITH PASSWORD 'grP0TNu0nGRDxUc9/Flhwo+Lj2z6P/UGJ0QN25c2gXc=';

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
