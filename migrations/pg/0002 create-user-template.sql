
-- Create user postgres
CREATE USER apidianuser WITH PASSWORD 'Admin@123';
-- Grant select privilege;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO apidianuser;
-- Grant all privileges;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO apidianuser;