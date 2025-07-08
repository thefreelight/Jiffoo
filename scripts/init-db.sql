-- Initialize Jiffoo Mall Database
-- This script will be executed when PostgreSQL container starts

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database if not exists (this is handled by POSTGRES_DB env var)
-- The database will be created automatically by the PostgreSQL container

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE jiffoo_mall TO jiffoo;

-- Note: Prisma will handle the table creation and migrations
