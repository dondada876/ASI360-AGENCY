-- Migration 013: Add timezone to client_profiles
ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles';
