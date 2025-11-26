-- Add cognito_user_id column to users table for AWS Cognito integration
-- This allows users to authenticate via Cognito and still map to our internal user system

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cognito_user_id VARCHAR(255) UNIQUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_cognito_user_id ON users(cognito_user_id);

-- Update comment on table
COMMENT ON COLUMN users.cognito_user_id IS 'AWS Cognito User Pool user identifier for OAuth authentication';
