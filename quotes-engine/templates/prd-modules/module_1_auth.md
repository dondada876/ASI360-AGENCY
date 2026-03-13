# MODULE 1: Authentication & Token System

> **Status:** Specification Complete
> **Owner:** ASI 360 Engineering
> **Supabase Project:** `gtfffxwfgcxiiauliynd` (asi360-commerce)
> **Last Updated:** 2026-03-10

---

## Table of Contents

1. [Overview](#1-overview)
2. [Token Architecture](#2-token-architecture)
3. [Database Schema](#3-database-schema)
4. [SQL Functions](#4-sql-functions)
5. [Auth Flow](#5-auth-flow)
6. [Edge Function](#6-edge-function)
7. [Token Delivery via Twilio SMS](#7-token-delivery-via-twilio-sms)
8. [Security Analysis](#8-security-analysis)
9. [Admin Tools](#9-admin-tools)
10. [Testing Plan](#10-testing-plan)
11. [Migration Checklist](#11-migration-checklist)

---

## 1. Overview

The 360 Quotes Engine client portal uses **PIN-based authentication** -- no user accounts, no passwords, no OAuth. Each project gets one or more 6-digit PINs that grant scoped access to project data (timeline, quotes, documents, change orders).

**Design Principles:**
- Zero friction: client receives a 6-digit PIN via SMS, enters it with their project number
- No user accounts to manage, no password resets, no email verification flows
- Two token types control what the bearer can see and do
- All cryptographic operations happen server-side in PostgreSQL via `pgcrypto`
- All secrets fetched at runtime from Supabase Vault via `get_secrets()` RPC
- Audit every access attempt for compliance and forensics

**Dependencies:**
- PostgreSQL `pgcrypto` extension (already enabled on `gtfffxwfgcxiiauliynd`)
- Existing `asi360_projects` table with `id`, `project_no`, `client_name`, `contact_name`, `contact_phone`, `contact_email`
- Twilio SMS from `+15102880994` (credentials in Supabase Vault)
- Supabase Edge Functions (Deno runtime)

---

## 2. Token Architecture

### 2.1 Token Format

| Property | Value |
|---|---|
| Format | 6-digit numeric string |
| Range | `100000` -- `999999` |
| Generation | `floor(random() * 900000 + 100000)::text` |
| Storage | bcrypt hash via `crypt(pin, gen_salt('bf'))` |
| Hint | Last 2 digits stored as `token_hint` (e.g., PIN `482917` -> hint `17`) |
| Delivery | Twilio SMS to `contact_phone` on the project record |

### 2.2 Token Types

| Type | Slug | Permissions |
|---|---|---|
| Client Read-Only | `client_readonly` | View project timeline, view quotes, view documents, view change order status |
| Admin Full Access | `admin_full` | Everything above + approve/reject change orders, download invoices, add comments, request callbacks |

### 2.3 Token Lifecycle

```
GENERATED -> ACTIVE -> EXPIRED / REVOKED
   |                      |
   +--- SMS delivered      +--- Manual revoke by admin
   |                      +--- Expiration (default 90 days)
   +--- Stored as bcrypt   +--- Rate-limit lockout (temporary)
        hash only
```

**Lifecycle rules:**
- Default expiration: 90 days from creation
- Admin tokens: 30 days (shorter window for elevated access)
- Tokens can be manually revoked at any time via `revoke_project_token()`
- Expired tokens return a specific error prompting the client to request a new one
- A project can have multiple active tokens (e.g., one per stakeholder)
- Revoking a token does NOT delete audit history

### 2.4 Token Scoping

Each token is scoped to exactly one project via `project_id` foreign key. There is no concept of a "global" token. A client with access to multiple projects receives separate PINs for each.

The `token_type` field controls authorization within the project scope. The Edge Function reads the type from the JWT claims and enforces it at the API layer.

---

## 3. Database Schema

### 3.1 Migration: Create Tables

```sql
-- Migration: 001_create_project_access_tokens
-- Description: PIN-based auth token storage and audit logging
-- Requires: pgcrypto extension, asi360_projects table

-- ============================================================
-- Table: project_access_tokens
-- Stores bcrypt-hashed PINs scoped to projects
-- ============================================================
CREATE TABLE project_access_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES asi360_projects(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  token_hint char(2) NOT NULL,
  client_phone text,
  client_email text,
  token_type text NOT NULL DEFAULT 'client_readonly'
    CHECK (token_type IN ('client_readonly', 'admin_full')),
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  last_accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text
);

COMMENT ON TABLE project_access_tokens IS
  'PIN-based access tokens for the 360 Quotes client portal. PINs stored as bcrypt hashes.';
COMMENT ON COLUMN project_access_tokens.token_hash IS
  'bcrypt hash of the 6-digit PIN via pgcrypto crypt(pin, gen_salt(''bf''))';
COMMENT ON COLUMN project_access_tokens.token_hint IS
  'Last 2 digits of the PIN for client identification (e.g., "17")';
COMMENT ON COLUMN project_access_tokens.token_type IS
  'client_readonly: view only. admin_full: view + approve + comment';
COMMENT ON COLUMN project_access_tokens.created_by IS
  'Who generated this token: system, admin:<email>, cli, airtable-button';

-- Indexes
CREATE INDEX idx_pat_project_id
  ON project_access_tokens(project_id);

CREATE INDEX idx_pat_active_tokens
  ON project_access_tokens(is_active)
  WHERE is_active = true;

CREATE INDEX idx_pat_project_active
  ON project_access_tokens(project_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_pat_expires
  ON project_access_tokens(expires_at)
  WHERE is_active = true;

-- ============================================================
-- Table: token_audit_log
-- Immutable append-only log of all auth events
-- ============================================================
CREATE TABLE token_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id uuid REFERENCES project_access_tokens(id) ON DELETE SET NULL,
  project_id uuid REFERENCES asi360_projects(id) ON DELETE SET NULL,
  action text NOT NULL
    CHECK (action IN (
      'token_generated',
      'token_validated',
      'token_validation_failed',
      'token_revoked',
      'token_expired_attempt',
      'rate_limit_triggered',
      'rate_limit_lockout',
      'token_refreshed',
      'sms_delivery_requested',
      'sms_delivery_confirmed',
      'sms_delivery_failed'
    )),
  ip_address inet,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE token_audit_log IS
  'Immutable audit trail for all authentication events. Never UPDATE or DELETE rows.';

CREATE INDEX idx_tal_project_id
  ON token_audit_log(project_id);

CREATE INDEX idx_tal_token_id
  ON token_audit_log(token_id);

CREATE INDEX idx_tal_action
  ON token_audit_log(action);

CREATE INDEX idx_tal_created_at
  ON token_audit_log(created_at DESC);

-- Rate-limit lookups: failures in last 15 minutes per project
CREATE INDEX idx_tal_rate_limit
  ON token_audit_log(project_id, created_at)
  WHERE success = false AND action = 'token_validation_failed';
```

### 3.2 Row-Level Security Policies

```sql
-- ============================================================
-- RLS: Lock both tables to service_role only
-- No anon or authenticated access -- Edge Function uses
-- service_role key to call SQL functions directly
-- ============================================================

ALTER TABLE project_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_audit_log ENABLE ROW LEVEL SECURITY;

-- project_access_tokens: service_role full access
CREATE POLICY "service_role_full_access_pat"
  ON project_access_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- token_audit_log: service_role full access
CREATE POLICY "service_role_full_access_tal"
  ON token_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicitly deny anon and authenticated roles
-- (RLS enabled + no policy = implicit deny, but being explicit)
CREATE POLICY "deny_anon_pat"
  ON project_access_tokens
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "deny_authenticated_pat"
  ON project_access_tokens
  FOR ALL
  TO authenticated
  USING (false);

CREATE POLICY "deny_anon_tal"
  ON token_audit_log
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "deny_authenticated_tal"
  ON token_audit_log
  FOR ALL
  TO authenticated
  USING (false);
```

### 3.3 Cleanup: Expired Token Sweeper

```sql
-- Periodic cleanup function (call via pg_cron or Edge Function cron)
CREATE OR REPLACE FUNCTION sweep_expired_tokens()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deactivated_count integer;
BEGIN
  UPDATE project_access_tokens
  SET is_active = false,
      revoked_at = now(),
      revoked_by = 'system:expiry_sweep'
  WHERE is_active = true
    AND expires_at < now();

  GET DIAGNOSTICS deactivated_count = ROW_COUNT;

  -- Log the sweep
  IF deactivated_count > 0 THEN
    INSERT INTO token_audit_log (action, success, metadata)
    VALUES (
      'token_expired_attempt',
      true,
      jsonb_build_object('swept_count', deactivated_count)
    );
  END IF;

  RETURN deactivated_count;
END;
$$;

COMMENT ON FUNCTION sweep_expired_tokens IS
  'Deactivates expired tokens. Run daily via pg_cron or scheduled Edge Function.';
```

---

## 4. SQL Functions

### 4.1 generate_project_token()

Generates a new 6-digit PIN for a project, stores the bcrypt hash, returns the plaintext PIN (only time it is ever readable).

```sql
CREATE OR REPLACE FUNCTION generate_project_token(
  p_project_id uuid,
  p_token_type text DEFAULT 'client_readonly',
  p_expires_days integer DEFAULT 90,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_created_by text DEFAULT 'system'
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pin text;
  v_pin_int integer;
  v_hash text;
  v_hint char(2);
  v_token_id uuid;
  v_project_exists boolean;
  v_actual_expires integer;
BEGIN
  -- Validate project exists
  SELECT EXISTS(
    SELECT 1 FROM asi360_projects WHERE id = p_project_id
  ) INTO v_project_exists;

  IF NOT v_project_exists THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  -- Validate token type
  IF p_token_type NOT IN ('client_readonly', 'admin_full') THEN
    RAISE EXCEPTION 'Invalid token type: %. Must be client_readonly or admin_full', p_token_type;
  END IF;

  -- Admin tokens max 30 days regardless of requested expiry
  IF p_token_type = 'admin_full' AND p_expires_days > 30 THEN
    v_actual_expires := 30;
  ELSE
    v_actual_expires := LEAST(p_expires_days, 365); -- Hard cap at 1 year
  END IF;

  -- Generate 6-digit PIN: 100000-999999
  v_pin_int := floor(random() * 900000 + 100000)::integer;
  v_pin := v_pin_int::text;

  -- Extract last 2 digits as hint
  v_hint := right(v_pin, 2);

  -- Hash with bcrypt via pgcrypto
  v_hash := crypt(v_pin, gen_salt('bf'));

  -- Insert the token record
  INSERT INTO project_access_tokens (
    project_id,
    token_hash,
    token_hint,
    client_phone,
    client_email,
    token_type,
    is_active,
    expires_at,
    created_by
  ) VALUES (
    p_project_id,
    v_hash,
    v_hint,
    p_phone,
    p_email,
    p_token_type,
    true,
    now() + (v_actual_expires || ' days')::interval,
    p_created_by
  )
  RETURNING id INTO v_token_id;

  -- Audit log
  INSERT INTO token_audit_log (
    token_id,
    project_id,
    action,
    success,
    metadata
  ) VALUES (
    v_token_id,
    p_project_id,
    'token_generated',
    true,
    jsonb_build_object(
      'token_type', p_token_type,
      'expires_days', v_actual_expires,
      'has_phone', p_phone IS NOT NULL,
      'has_email', p_email IS NOT NULL,
      'created_by', p_created_by
    )
  );

  -- Return plaintext PIN (only time it is ever available)
  RETURN v_pin;
END;
$$;

COMMENT ON FUNCTION generate_project_token IS
  'Generates a 6-digit PIN, stores bcrypt hash, returns plaintext PIN. PIN is only available at generation time.';
```

### 4.2 validate_project_token()

Validates a PIN against a project. Returns a JSONB result with project details and token type on success.

```sql
CREATE OR REPLACE FUNCTION validate_project_token(
  p_project_no text,
  p_pin text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
  v_project_name text;
  v_client_name text;
  v_token_record RECORD;
  v_is_rate_limited boolean;
  v_result jsonb;
BEGIN
  -- --------------------------------------------------------
  -- Step 1: Lookup project by project_no
  -- --------------------------------------------------------
  SELECT id, project_name, client_name
  INTO v_project_id, v_project_name, v_client_name
  FROM asi360_projects
  WHERE project_no = p_project_no;

  IF v_project_id IS NULL THEN
    -- Do NOT reveal whether the project exists
    -- Use constant-time-ish response (still log it)
    INSERT INTO token_audit_log (action, success, failure_reason, ip_address, user_agent, metadata)
    VALUES (
      'token_validation_failed', false, 'project_not_found',
      p_ip_address, p_user_agent,
      jsonb_build_object('project_no', p_project_no)
    );

    RETURN jsonb_build_object(
      'valid', false,
      'error', 'invalid_credentials',
      'message', 'Invalid project number or PIN'
    );
  END IF;

  -- --------------------------------------------------------
  -- Step 2: Check rate limit BEFORE attempting validation
  -- --------------------------------------------------------
  SELECT check_rate_limit(v_project_id) INTO v_is_rate_limited;

  IF v_is_rate_limited THEN
    INSERT INTO token_audit_log (
      project_id, action, success, failure_reason,
      ip_address, user_agent
    ) VALUES (
      v_project_id, 'rate_limit_lockout', false, 'too_many_attempts',
      p_ip_address, p_user_agent
    );

    RETURN jsonb_build_object(
      'valid', false,
      'error', 'rate_limited',
      'message', 'Too many failed attempts. Please try again in 15 minutes.'
    );
  END IF;

  -- --------------------------------------------------------
  -- Step 3: Iterate active, non-expired tokens for this project
  -- Use pgcrypto crypt() for constant-time comparison
  -- --------------------------------------------------------
  FOR v_token_record IN
    SELECT id, token_hash, token_type, expires_at
    FROM project_access_tokens
    WHERE project_id = v_project_id
      AND is_active = true
      AND expires_at > now()
    ORDER BY created_at DESC
  LOOP
    -- pgcrypto crypt(input, existing_hash) returns existing_hash if match
    -- This is constant-time comparison at the bcrypt level
    IF crypt(p_pin, v_token_record.token_hash) = v_token_record.token_hash THEN
      -- ---- MATCH FOUND ----

      -- Update access tracking
      UPDATE project_access_tokens
      SET last_accessed_at = now(),
          access_count = access_count + 1
      WHERE id = v_token_record.id;

      -- Audit: success
      INSERT INTO token_audit_log (
        token_id, project_id, action, success,
        ip_address, user_agent
      ) VALUES (
        v_token_record.id, v_project_id,
        'token_validated', true,
        p_ip_address, p_user_agent
      );

      -- Return success payload (used by Edge Function to mint JWT)
      RETURN jsonb_build_object(
        'valid', true,
        'project_id', v_project_id,
        'project_no', p_project_no,
        'project_name', v_project_name,
        'client_name', v_client_name,
        'token_id', v_token_record.id,
        'token_type', v_token_record.token_type,
        'expires_at', v_token_record.expires_at
      );
    END IF;
  END LOOP;

  -- --------------------------------------------------------
  -- Step 4: No match found
  -- --------------------------------------------------------
  INSERT INTO token_audit_log (
    project_id, action, success, failure_reason,
    ip_address, user_agent,
    metadata
  ) VALUES (
    v_project_id, 'token_validation_failed', false, 'invalid_pin',
    p_ip_address, p_user_agent,
    jsonb_build_object('project_no', p_project_no)
  );

  RETURN jsonb_build_object(
    'valid', false,
    'error', 'invalid_credentials',
    'message', 'Invalid project number or PIN'
  );
END;
$$;

COMMENT ON FUNCTION validate_project_token IS
  'Validates a 6-digit PIN against a project. Returns JSONB with project details on success, error on failure. Rate-limited.';
```

### 4.3 revoke_project_token()

```sql
CREATE OR REPLACE FUNCTION revoke_project_token(
  p_token_id uuid,
  p_revoked_by text DEFAULT 'admin'
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
  v_was_active boolean;
BEGIN
  -- Get current state
  SELECT project_id, is_active
  INTO v_project_id, v_was_active
  FROM project_access_tokens
  WHERE id = p_token_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Token not found: %', p_token_id;
  END IF;

  IF NOT v_was_active THEN
    RETURN false; -- Already revoked, no-op
  END IF;

  -- Deactivate
  UPDATE project_access_tokens
  SET is_active = false,
      revoked_at = now(),
      revoked_by = p_revoked_by
  WHERE id = p_token_id;

  -- Audit log
  INSERT INTO token_audit_log (
    token_id, project_id, action, success,
    metadata
  ) VALUES (
    p_token_id, v_project_id,
    'token_revoked', true,
    jsonb_build_object('revoked_by', p_revoked_by)
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION revoke_project_token IS
  'Deactivates a token and logs the revocation. Returns false if already revoked.';
```

### 4.4 check_rate_limit()

```sql
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_project_id uuid,
  p_window_minutes integer DEFAULT 15,
  p_max_failures integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_failure_count integer;
BEGIN
  SELECT count(*)
  INTO v_failure_count
  FROM token_audit_log
  WHERE project_id = p_project_id
    AND action = 'token_validation_failed'
    AND success = false
    AND created_at > now() - (p_window_minutes || ' minutes')::interval;

  RETURN v_failure_count >= p_max_failures;
END;
$$;

COMMENT ON FUNCTION check_rate_limit IS
  'Returns true if a project has exceeded the failure threshold in the rolling window. Default: 5 failures in 15 minutes.';
```

### 4.5 check_rate_limit_by_ip()

Additional rate limiter keyed on IP address to prevent distributed attacks across projects.

```sql
CREATE OR REPLACE FUNCTION check_rate_limit_by_ip(
  p_ip_address inet,
  p_window_minutes integer DEFAULT 15,
  p_max_failures integer DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_failure_count integer;
BEGIN
  IF p_ip_address IS NULL THEN
    RETURN false; -- Cannot rate-limit without IP
  END IF;

  SELECT count(*)
  INTO v_failure_count
  FROM token_audit_log
  WHERE ip_address = p_ip_address
    AND action = 'token_validation_failed'
    AND success = false
    AND created_at > now() - (p_window_minutes || ' minutes')::interval;

  RETURN v_failure_count >= p_max_failures;
END;
$$;

COMMENT ON FUNCTION check_rate_limit_by_ip IS
  'IP-based rate limiter. Default: 10 failures in 15 minutes across all projects from one IP.';
```

### 4.6 request_token_via_sms()

Self-service function: client provides project_no + phone. If phone matches `contact_phone` on the project, generate a new token and return a signal that SMS should be sent.

```sql
CREATE OR REPLACE FUNCTION request_token_via_sms(
  p_project_no text,
  p_phone text,
  p_ip_address inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id uuid;
  v_project_name text;
  v_contact_phone text;
  v_pin text;
  v_is_rate_limited boolean;
BEGIN
  -- Lookup project and contact phone
  SELECT id, project_name, contact_phone
  INTO v_project_id, v_project_name, v_contact_phone
  FROM asi360_projects
  WHERE project_no = p_project_no;

  IF v_project_id IS NULL THEN
    -- Generic error, do not reveal project existence
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found',
      'message', 'If this project exists and the phone matches, you will receive an SMS.'
    );
  END IF;

  -- Rate limit: max 3 SMS requests per hour per project
  SELECT count(*) >= 3
  INTO v_is_rate_limited
  FROM token_audit_log
  WHERE project_id = v_project_id
    AND action = 'sms_delivery_requested'
    AND created_at > now() - interval '1 hour';

  IF v_is_rate_limited THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'rate_limited',
      'message', 'Too many PIN requests. Please try again in 1 hour.'
    );
  END IF;

  -- Normalize phone comparison (strip spaces, dashes)
  -- Only proceed if phone matches contact_phone
  IF regexp_replace(p_phone, '[^0-9+]', '', 'g')
     != regexp_replace(COALESCE(v_contact_phone, ''), '[^0-9+]', '', 'g')
  THEN
    -- Log the attempt but return generic message
    INSERT INTO token_audit_log (
      project_id, action, success, failure_reason,
      ip_address,
      metadata
    ) VALUES (
      v_project_id, 'sms_delivery_requested', false, 'phone_mismatch',
      p_ip_address,
      jsonb_build_object('project_no', p_project_no)
    );

    -- Same message regardless of match to prevent enumeration
    RETURN jsonb_build_object(
      'success', true,
      'message', 'If this project exists and the phone matches, you will receive an SMS.'
    );
  END IF;

  -- Phone matches -- revoke any existing client_readonly tokens for this project
  UPDATE project_access_tokens
  SET is_active = false,
      revoked_at = now(),
      revoked_by = 'system:new_sms_request'
  WHERE project_id = v_project_id
    AND token_type = 'client_readonly'
    AND is_active = true
    AND client_phone = p_phone;

  -- Generate new token
  v_pin := generate_project_token(
    p_project_id := v_project_id,
    p_token_type := 'client_readonly',
    p_expires_days := 90,
    p_phone := p_phone,
    p_created_by := 'self_service_sms'
  );

  -- Log SMS request
  INSERT INTO token_audit_log (
    project_id, action, success,
    ip_address,
    metadata
  ) VALUES (
    v_project_id, 'sms_delivery_requested', true,
    p_ip_address,
    jsonb_build_object(
      'project_no', p_project_no,
      'phone_last4', right(p_phone, 4)
    )
  );

  -- Return PIN + phone so the Edge Function can send SMS
  RETURN jsonb_build_object(
    'success', true,
    'send_sms', true,
    'phone', p_phone,
    'pin', v_pin,
    'project_name', v_project_name,
    'project_no', p_project_no,
    'message', 'If this project exists and the phone matches, you will receive an SMS.'
  );
END;
$$;

COMMENT ON FUNCTION request_token_via_sms IS
  'Self-service PIN request. If phone matches project contact, generates a new PIN and signals SMS delivery.';
```

---

## 5. Auth Flow

### 5.1 Flow Diagram

```
CLIENT                          EDGE FUNCTION                    SUPABASE
  |                                  |                              |
  |-- POST /auth/lookup ------------>|                              |
  |   { project_no }                 |-- SELECT project_name ------>|
  |                                  |<-- { name, exists } ---------|
  |<-- { project_name } -------------|                              |
  |                                  |                              |
  |-- POST /auth/validate --------->|                              |
  |   { project_no, pin }           |-- validate_project_token() ->|
  |                                  |<-- { valid, project_id, ... }|
  |                                  |                              |
  |                                  |-- Sign JWT (HS256) -------->|
  |<-- { token: "eyJ..." } ---------|                              |
  |                                  |                              |
  |-- GET /api/timeline ----------->|                              |
  |   Authorization: Bearer eyJ...   |-- Verify JWT -------------->|
  |                                  |-- Query with project_id --->|
  |<-- { timeline data } -----------|<-- { rows } ----------------|
```

### 5.2 Endpoint Definitions

| Method | Path | Body | Response | Rate Limit |
|---|---|---|---|---|
| `POST` | `/auth/lookup` | `{ project_no }` | `{ exists, project_name }` | 20/min per IP |
| `POST` | `/auth/validate` | `{ project_no, pin }` | `{ token }` or `{ error }` | 5 failures/15min per project, 10/15min per IP |
| `POST` | `/auth/request-pin` | `{ project_no, phone }` | `{ message }` (always same) | 3/hour per project |
| `POST` | `/auth/refresh` | `Authorization: Bearer <jwt>` | `{ token }` (new JWT) | 10/hour per token |

### 5.3 JWT Claims

```json
{
  "sub": "project_id_uuid",
  "project_no": "PROJ-202603-1234",
  "project_name": "Goldman Law Firm -- Access Control",
  "token_type": "client_readonly",
  "token_id": "token_uuid",
  "iss": "asi360-portal",
  "aud": "projects.asi360.co",
  "iat": 1710000000,
  "exp": 1710086400
}
```

- JWT lifetime: **24 hours**
- Signing algorithm: **HS256**
- Signing key: Supabase JWT secret (from `get_secrets(['supabase_jwt_secret'])`)
- Refresh: client can POST `/auth/refresh` with a valid non-expired JWT to get a new 24hr JWT without re-entering the PIN

### 5.4 Rate Limiting Strategy

| Layer | Scope | Threshold | Window | Action |
|---|---|---|---|---|
| Project PIN validation | `project_id` | 5 failures | 15 min | Reject with `rate_limited` |
| IP PIN validation | `ip_address` | 10 failures | 15 min | Reject with `rate_limited` |
| Project lockout | `project_id` | 10 failures | 15 min | Log `rate_limit_lockout`, require admin reset or 15min cooldown |
| SMS request | `project_id` | 3 requests | 60 min | Reject with `rate_limited` |
| Lookup | `ip_address` | 20 requests | 1 min | 429 response |

---

## 6. Edge Function

### 6.1 project-portal-auth Edge Function

```typescript
// supabase/functions/project-portal-auth/index.ts
//
// 360 Quotes Engine -- Authentication Edge Function
// Endpoints: /auth/lookup, /auth/validate, /auth/request-pin, /auth/refresh
//
// Secrets: loaded from Supabase Vault via get_secrets() RPC
// JWT: signed with HS256 using Supabase JWT secret

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Types
// ============================================================

interface AuthLookupRequest {
  project_no: string;
}

interface AuthValidateRequest {
  project_no: string;
  pin: string;
}

interface AuthRequestPinRequest {
  project_no: string;
  phone: string;
}

interface JWTPayload {
  sub: string;
  project_no: string;
  project_name: string;
  token_type: string;
  token_id: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

// ============================================================
// CORS Headers
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://projects.asi360.co",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info",
  "Access-Control-Max-Age": "86400",
};

function corsResponse(body: string | null, status: number, extra?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...(extra || {}),
    },
  });
}

// ============================================================
// JWT Signing (HS256)
// ============================================================

async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Decode base64url signature
    const sigStr = encodedSignature
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const sigBytes = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(signingInput)
    );

    if (!valid) return null;

    // Decode payload
    const payloadStr = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const payload: JWTPayload = JSON.parse(atob(payloadStr));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================================
// Secrets Cache
// ============================================================

let cachedSecrets: Record<string, string> | null = null;
let secretsFetchedAt = 0;
const SECRETS_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSecrets(
  sb: ReturnType<typeof createClient>
): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedSecrets && now - secretsFetchedAt < SECRETS_TTL_MS) {
    return cachedSecrets;
  }

  const { data, error } = await sb.rpc("get_secrets", {
    secret_names: ["supabase_jwt_secret", "twilio_account_sid", "twilio_auth_token", "twilio_phone_number"],
  });

  if (error) throw new Error(`Failed to load secrets: ${error.message}`);

  cachedSecrets = Object.fromEntries(
    (data as Array<{ name: string; secret: string }>).map((s) => [s.name, s.secret])
  );
  secretsFetchedAt = now;
  return cachedSecrets;
}

// ============================================================
// Twilio SMS
// ============================================================

async function sendSMS(
  to: string,
  body: string,
  secrets: Record<string, string>
): Promise<boolean> {
  const accountSid = secrets["twilio_account_sid"];
  const authToken = secrets["twilio_auth_token"];
  const fromNumber = secrets["twilio_phone_number"] || "+15102880994";

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("From", fromNumber);
  params.set("Body", body);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  return resp.ok;
}

// ============================================================
// Route Handlers
// ============================================================

async function handleLookup(
  body: AuthLookupRequest,
  sb: ReturnType<typeof createClient>,
  clientIP: string
): Promise<Response> {
  const { project_no } = body;

  if (!project_no || typeof project_no !== "string") {
    return corsResponse(
      JSON.stringify({ error: "missing_field", message: "project_no is required" }),
      400
    );
  }

  // Sanitize: project_no should match PROJ-YYYYMM-NNNN pattern
  if (!/^PROJ-\d{6}-\d{1,6}$/.test(project_no.trim())) {
    return corsResponse(
      JSON.stringify({ error: "invalid_format", message: "Invalid project number format" }),
      400
    );
  }

  const { data, error } = await sb
    .from("asi360_projects")
    .select("project_name, client_name, status")
    .eq("project_no", project_no.trim())
    .maybeSingle();

  if (error || !data) {
    return corsResponse(
      JSON.stringify({ exists: false }),
      200
    );
  }

  return corsResponse(
    JSON.stringify({
      exists: true,
      project_name: data.project_name,
      client_name: data.client_name,
      status: data.status,
    }),
    200
  );
}

async function handleValidate(
  body: AuthValidateRequest,
  sb: ReturnType<typeof createClient>,
  secrets: Record<string, string>,
  clientIP: string,
  userAgent: string
): Promise<Response> {
  const { project_no, pin } = body;

  if (!project_no || !pin) {
    return corsResponse(
      JSON.stringify({ error: "missing_fields", message: "project_no and pin are required" }),
      400
    );
  }

  // Validate PIN format: exactly 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return corsResponse(
      JSON.stringify({ error: "invalid_pin_format", message: "PIN must be exactly 6 digits" }),
      400
    );
  }

  // IP-level rate limit check
  const { data: ipLimited } = await sb.rpc("check_rate_limit_by_ip", {
    p_ip_address: clientIP,
  });

  if (ipLimited === true) {
    return corsResponse(
      JSON.stringify({
        error: "rate_limited",
        message: "Too many failed attempts from your network. Please try again later.",
      }),
      429
    );
  }

  // Call the validate function
  const { data: result, error } = await sb.rpc("validate_project_token", {
    p_project_no: project_no.trim(),
    p_pin: pin,
    p_ip_address: clientIP,
    p_user_agent: userAgent,
  });

  if (error) {
    console.error("validate_project_token error:", error);
    return corsResponse(
      JSON.stringify({ error: "internal_error", message: "Authentication service unavailable" }),
      500
    );
  }

  if (!result.valid) {
    const status = result.error === "rate_limited" ? 429 : 401;
    return corsResponse(
      JSON.stringify({ error: result.error, message: result.message }),
      status
    );
  }

  // Mint JWT
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JWTPayload = {
    sub: result.project_id,
    project_no: result.project_no,
    project_name: result.project_name,
    token_type: result.token_type,
    token_id: result.token_id,
    iss: "asi360-portal",
    aud: "projects.asi360.co",
    iat: now,
    exp: now + 86400, // 24 hours
  };

  const jwtSecret = secrets["supabase_jwt_secret"];
  const jwt = await signJWT(jwtPayload, jwtSecret);

  return corsResponse(
    JSON.stringify({
      token: jwt,
      token_type: result.token_type,
      project_name: result.project_name,
      client_name: result.client_name,
      expires_in: 86400,
    }),
    200
  );
}

async function handleRequestPin(
  body: AuthRequestPinRequest,
  sb: ReturnType<typeof createClient>,
  secrets: Record<string, string>,
  clientIP: string
): Promise<Response> {
  const { project_no, phone } = body;

  if (!project_no || !phone) {
    return corsResponse(
      JSON.stringify({ error: "missing_fields", message: "project_no and phone are required" }),
      400
    );
  }

  // Normalize phone: must start with + and have at least 10 digits
  const normalizedPhone = phone.replace(/[^0-9+]/g, "");
  if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
    return corsResponse(
      JSON.stringify({ error: "invalid_phone", message: "Phone must include country code (e.g., +15101234567)" }),
      400
    );
  }

  const { data: result, error } = await sb.rpc("request_token_via_sms", {
    p_project_no: project_no.trim(),
    p_phone: normalizedPhone,
    p_ip_address: clientIP,
  });

  if (error) {
    console.error("request_token_via_sms error:", error);
    // Return generic message even on internal error
    return corsResponse(
      JSON.stringify({
        message: "If this project exists and the phone matches, you will receive an SMS.",
      }),
      200
    );
  }

  // If the function signals we should send SMS
  if (result.send_sms && result.pin && result.phone) {
    const smsBody = [
      `ASI 360 Project Portal`,
      ``,
      `Your access PIN for ${result.project_name}:`,
      ``,
      `PIN: ${result.pin}`,
      `Project: ${result.project_no}`,
      ``,
      `Enter at: https://projects.asi360.co`,
      ``,
      `This PIN expires in 90 days. Do not share it.`,
    ].join("\n");

    const smsSent = await sendSMS(result.phone, smsBody, secrets);

    // Log delivery status
    await sb.rpc("", {}).catch(() => {}); // no-op; log via direct insert below
    const action = smsSent ? "sms_delivery_confirmed" : "sms_delivery_failed";
    await sb.from("token_audit_log").insert({
      project_id: null, // Don't leak project_id mapping
      action,
      success: smsSent,
      metadata: { project_no: result.project_no, phone_last4: normalizedPhone.slice(-4) },
    });
  }

  // Always return the same generic message
  return corsResponse(
    JSON.stringify({
      message: "If this project exists and the phone matches, you will receive an SMS.",
    }),
    200
  );
}

async function handleRefresh(
  authHeader: string | null,
  sb: ReturnType<typeof createClient>,
  secrets: Record<string, string>
): Promise<Response> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return corsResponse(
      JSON.stringify({ error: "unauthorized", message: "Bearer token required" }),
      401
    );
  }

  const existingToken = authHeader.slice(7);
  const jwtSecret = secrets["supabase_jwt_secret"];
  const payload = await verifyJWT(existingToken, jwtSecret);

  if (!payload) {
    return corsResponse(
      JSON.stringify({ error: "invalid_token", message: "Token is invalid or expired" }),
      401
    );
  }

  // Verify the underlying project token is still active
  const { data: tokenCheck } = await sb
    .from("project_access_tokens")
    .select("is_active, expires_at")
    .eq("id", payload.token_id)
    .maybeSingle();

  if (!tokenCheck || !tokenCheck.is_active || new Date(tokenCheck.expires_at) < new Date()) {
    return corsResponse(
      JSON.stringify({ error: "token_revoked", message: "Your access has been revoked. Please request a new PIN." }),
      401
    );
  }

  // Mint fresh JWT
  const now = Math.floor(Date.now() / 1000);
  const newPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + 86400,
  };

  const jwt = await signJWT(newPayload, jwtSecret);

  return corsResponse(
    JSON.stringify({
      token: jwt,
      token_type: payload.token_type,
      expires_in: 86400,
    }),
    200
  );
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(null, 204);
  }

  if (req.method !== "POST") {
    return corsResponse(
      JSON.stringify({ error: "method_not_allowed" }),
      405
    );
  }

  // Extract client metadata
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "0.0.0.0";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Parse URL path
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/project-portal-auth/, "");

  // Initialize Supabase client (service_role for RPC calls)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseServiceKey);

  // Load secrets
  let secrets: Record<string, string>;
  try {
    secrets = await getSecrets(sb);
  } catch (err) {
    console.error("Secret loading failed:", err);
    return corsResponse(
      JSON.stringify({ error: "internal_error", message: "Service temporarily unavailable" }),
      503
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    switch (path) {
      case "/auth/lookup":
        return await handleLookup(body as AuthLookupRequest, sb, clientIP);

      case "/auth/validate":
        return await handleValidate(
          body as AuthValidateRequest,
          sb,
          secrets,
          clientIP,
          userAgent
        );

      case "/auth/request-pin":
        return await handleRequestPin(
          body as AuthRequestPinRequest,
          sb,
          secrets,
          clientIP
        );

      case "/auth/refresh":
        return await handleRefresh(req.headers.get("authorization"), sb, secrets);

      default:
        return corsResponse(
          JSON.stringify({ error: "not_found", message: "Unknown endpoint" }),
          404
        );
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return corsResponse(
      JSON.stringify({ error: "internal_error", message: "An unexpected error occurred" }),
      500
    );
  }
});
```

---

## 7. Token Delivery via Twilio SMS

### 7.1 SMS Message Template

```
ASI 360 Project Portal

Your access PIN for Goldman Law Firm -- Access Control Upgrade:

PIN: 482917
Project: PROJ-202603-1234

Enter at: https://projects.asi360.co

This PIN expires in 90 days. Do not share it.
```

### 7.2 Self-Service Request Flow

```
CLIENT                     EDGE FUNCTION                   SUPABASE         TWILIO
  |                             |                              |               |
  |-- POST /auth/request-pin -->|                              |               |
  |   { project_no, phone }    |                              |               |
  |                             |-- request_token_via_sms() -->|               |
  |                             |<-- { send_sms, pin, phone } -|               |
  |                             |                              |               |
  |                             |-- POST Messages.json --------|-------------->|
  |                             |                              |    SMS to     |
  |                             |                              |    client     |
  |<-- "You will receive..." ---|                              |               |
  |                                                                            |
  |<-- SMS: "Your PIN: 482917" ------------------------------------------------|
```

**Key behaviors:**
- Response is always the same generic message regardless of match/mismatch (prevents enumeration)
- Phone comparison strips all non-digit/plus characters before comparing
- Maximum 3 SMS requests per project per hour
- Old client_readonly tokens for the same phone are auto-revoked when a new PIN is generated

### 7.3 Admin-Initiated Token + SMS Delivery

For admin-initiated token generation (e.g., after project creation), use the Edge Function's internal SMS capability by calling `generate_project_token()` directly from a backend script and then triggering Twilio:

```typescript
// admin-scripts/send-project-pin.ts
// Usage: deno run --allow-net --allow-env send-project-pin.ts <project_id> <phone>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_KEY")!
);

const projectId = Deno.args[0];
const phone = Deno.args[1];

if (!projectId || !phone) {
  console.error("Usage: send-project-pin.ts <project_id> <phone>");
  Deno.exit(1);
}

// Generate token
const { data: pin, error } = await sb.rpc("generate_project_token", {
  p_project_id: projectId,
  p_token_type: "client_readonly",
  p_expires_days: 90,
  p_phone: phone,
  p_created_by: "admin:cli",
});

if (error) {
  console.error("Failed to generate token:", error.message);
  Deno.exit(1);
}

// Get project info for SMS
const { data: project } = await sb
  .from("asi360_projects")
  .select("project_name, project_no")
  .eq("id", projectId)
  .single();

// Load Twilio secrets
const { data: secrets } = await sb.rpc("get_secrets", {
  secret_names: ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"],
});
const sec = Object.fromEntries(secrets.map((s: any) => [s.name, s.secret]));

// Send SMS
const params = new URLSearchParams({
  To: phone,
  From: sec["twilio_phone_number"] || "+15102880994",
  Body: [
    `ASI 360 Project Portal`,
    ``,
    `Your access PIN for ${project.project_name}:`,
    ``,
    `PIN: ${pin}`,
    `Project: ${project.project_no}`,
    ``,
    `Enter at: https://projects.asi360.co`,
    ``,
    `This PIN expires in 90 days. Do not share it.`,
  ].join("\n"),
});

const resp = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${sec["twilio_account_sid"]}/Messages.json`,
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sec["twilio_account_sid"]}:${sec["twilio_auth_token"]}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  }
);

if (resp.ok) {
  console.log(`PIN sent to ${phone} for project ${project.project_no}`);
  console.log(`PIN hint: **${pin.slice(-2)} (last 2 digits)`);
} else {
  const err = await resp.text();
  console.error("SMS failed:", err);
}
```

---

## 8. Security Analysis

### 8.1 Token Entropy

| Property | Value |
|---|---|
| PIN space | 100,000 -- 999,999 (900,000 unique values) |
| Bits of entropy | log2(900,000) = ~19.8 bits |
| Brute-force at 5 attempts/15min | 900,000 / (5 * 4 * 24) = ~1,875 days (~5.1 years) |
| Brute-force with IP limit (10/15min) | 900,000 / (10 * 4 * 24) = ~937 days (~2.6 years) |
| Combined rate limits | Effective minimum: **2.6 years per project** |
| With lockout (10 failures = lockout) | Attacker gets 10 tries, then waits 15 min. At ~960 attempts/day = **937+ days** |

**Assessment:** 6-digit PINs are adequate for this threat model because:
1. Rate limiting reduces effective throughput to ~960 attempts/day max
2. Audit logging enables detection long before brute-force succeeds
3. PINs expire (90 days default), shrinking the attack window
4. No high-value financial transactions are authorized via the portal
5. The PIN is one factor; the project number is a second (must know both)

### 8.2 Cryptographic Properties

| Measure | Implementation |
|---|---|
| Hash algorithm | bcrypt via pgcrypto `crypt(pin, gen_salt('bf'))` |
| Salt | Automatic per-hash via `gen_salt('bf')` (128-bit random salt) |
| Constant-time comparison | pgcrypto `crypt()` is constant-time; equality check on fixed-length hashes |
| PIN generation | PostgreSQL `random()` -- acceptable for 6-digit numeric PINs (not crypto-grade but sufficient given bcrypt storage) |
| JWT signing | HMAC-SHA256 via Web Crypto API (constant-time) |

### 8.3 Attack Surface Mitigation

| Attack Vector | Mitigation |
|---|---|
| PIN brute-force | Rate limiting (5/project + 10/IP per 15min), audit alerts |
| Project number enumeration | `/auth/lookup` returns minimal info; `/auth/request-pin` always returns same message |
| Phone enumeration | SMS request returns identical response regardless of match |
| Token theft (JWT) | 24hr expiration, token_id in JWT allows server-side revocation check |
| Database breach | PINs stored as bcrypt hashes, not recoverable |
| Replay attacks | JWT `exp` + `iat` claims; refresh rotates JWT |
| CSRF | No cookies used; Bearer token in Authorization header |
| XSS token theft | httpOnly not applicable (SPA); but short JWT lifetime limits exposure |

### 8.4 RLS Enforcement

Both tables have RLS enabled with only `service_role` granted access. The Edge Function connects with `SUPABASE_SERVICE_ROLE_KEY` to call the SQL functions (which are `SECURITY DEFINER`). No client-side Supabase client can ever read or write these tables directly.

---

## 9. Admin Tools

### 9.1 CLI: Generate Token

```bash
#!/usr/bin/env bash
# scripts/generate-token.sh
# Usage: ./generate-token.sh <project_no> [token_type] [expires_days]
#
# Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY in environment

set -euo pipefail

PROJECT_NO="${1:?Usage: generate-token.sh <project_no> [token_type] [expires_days]}"
TOKEN_TYPE="${2:-client_readonly}"
EXPIRES_DAYS="${3:-90}"

# Get project ID from project_no
PROJECT_ID=$(curl -s \
  "${SUPABASE_URL}/rest/v1/asi360_projects?project_no=eq.${PROJECT_NO}&select=id" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: Project ${PROJECT_NO} not found"
  exit 1
fi

# Generate token via RPC
RESULT=$(curl -s \
  "${SUPABASE_URL}/rest/v1/rpc/generate_project_token" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_project_id\": \"${PROJECT_ID}\",
    \"p_token_type\": \"${TOKEN_TYPE}\",
    \"p_expires_days\": ${EXPIRES_DAYS},
    \"p_created_by\": \"admin:cli\"
  }")

# RESULT is the plaintext PIN (quoted string from PostgREST)
PIN=$(echo "$RESULT" | tr -d '"')

echo "============================================"
echo "  360 Quotes Engine -- Token Generated"
echo "============================================"
echo "  Project:     ${PROJECT_NO}"
echo "  Token Type:  ${TOKEN_TYPE}"
echo "  Expires:     ${EXPIRES_DAYS} days"
echo "  PIN:         ${PIN}"
echo "  PIN Hint:    **${PIN: -2}"
echo "============================================"
echo ""
echo "  Send to client:"
echo "  Your ASI 360 portal PIN is: ${PIN}"
echo "  Project: ${PROJECT_NO}"
echo "  Login at: https://projects.asi360.co"
echo "============================================"
```

### 9.2 CLI: Revoke Token

```bash
#!/usr/bin/env bash
# scripts/revoke-token.sh
# Usage: ./revoke-token.sh <token_id>

set -euo pipefail

TOKEN_ID="${1:?Usage: revoke-token.sh <token_id>}"

RESULT=$(curl -s \
  "${SUPABASE_URL}/rest/v1/rpc/revoke_project_token" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"p_token_id\": \"${TOKEN_ID}\", \"p_revoked_by\": \"admin:cli\"}")

echo "Revoke result: ${RESULT}"
```

### 9.3 CLI: List Active Tokens for a Project

```bash
#!/usr/bin/env bash
# scripts/list-tokens.sh
# Usage: ./list-tokens.sh <project_no>

set -euo pipefail

PROJECT_NO="${1:?Usage: list-tokens.sh <project_no>}"

curl -s \
  "${SUPABASE_URL}/rest/v1/project_access_tokens?select=id,token_hint,token_type,is_active,expires_at,access_count,last_accessed_at,client_phone,created_by,created_at&project_id=eq.(select id from asi360_projects where project_no='${PROJECT_NO}')&is_active=eq.true&order=created_at.desc" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  | python3 -m json.tool
```

### 9.4 Bulk Token Generation

For onboarding multiple projects (e.g., after a batch of quotes are approved):

```sql
-- Bulk generate tokens for all projects in "initiated" status
-- that do not yet have an active token
-- Returns a table of project_no, pin for SMS distribution
DO $$
DECLARE
  r RECORD;
  v_pin text;
BEGIN
  RAISE NOTICE 'project_no | pin | phone';
  RAISE NOTICE '-----------+--------+----------------';

  FOR r IN
    SELECT p.id, p.project_no, p.contact_phone, p.contact_email
    FROM asi360_projects p
    WHERE p.status = 'initiated'
      AND NOT EXISTS (
        SELECT 1 FROM project_access_tokens t
        WHERE t.project_id = p.id AND t.is_active = true
      )
  LOOP
    v_pin := generate_project_token(
      p_project_id := r.id,
      p_token_type := 'client_readonly',
      p_expires_days := 90,
      p_phone := r.contact_phone,
      p_email := r.contact_email,
      p_created_by := 'admin:bulk_generate'
    );

    RAISE NOTICE '% | % | %', r.project_no, v_pin, r.contact_phone;
  END LOOP;
END;
$$;
```

### 9.5 Airtable Button Integration

To trigger token generation from an Airtable button in the CEO Dashboard or Ops Hub, create a webhook endpoint on the Gateway MCP or a dedicated Edge Function:

```typescript
// supabase/functions/airtable-generate-token/index.ts
// Triggered by Airtable "Send Portal PIN" button
// Expects: { project_no, phone, email }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify Airtable webhook secret
  const webhookSecret = req.headers.get("x-webhook-secret");
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: secrets } = await sb.rpc("get_secrets", {
    secret_names: ["airtable_webhook_secret"],
  });
  const expectedSecret = secrets?.find((s: any) => s.name === "airtable_webhook_secret")?.secret;

  if (webhookSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const { project_no, phone, email } = await req.json();

  // Get project ID
  const { data: project } = await sb
    .from("asi360_projects")
    .select("id, project_name")
    .eq("project_no", project_no)
    .single();

  if (!project) {
    return new Response(
      JSON.stringify({ error: "project_not_found" }),
      { status: 404 }
    );
  }

  // Generate token
  const { data: pin } = await sb.rpc("generate_project_token", {
    p_project_id: project.id,
    p_token_type: "client_readonly",
    p_expires_days: 90,
    p_phone: phone || null,
    p_email: email || null,
    p_created_by: "airtable-button",
  });

  // Send SMS if phone provided
  if (phone) {
    const { data: twilioSecrets } = await sb.rpc("get_secrets", {
      secret_names: ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"],
    });
    const sec = Object.fromEntries(twilioSecrets.map((s: any) => [s.name, s.secret]));

    const params = new URLSearchParams({
      To: phone,
      From: sec["twilio_phone_number"] || "+15102880994",
      Body: `ASI 360 Project Portal\n\nYour access PIN for ${project.project_name}:\n\nPIN: ${pin}\nProject: ${project_no}\n\nEnter at: https://projects.asi360.co\n\nExpires in 90 days.`,
    });

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sec["twilio_account_sid"]}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sec["twilio_account_sid"]}:${sec["twilio_auth_token"]}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      project_no,
      pin_hint: `**${pin.slice(-2)}`,
      sms_sent: !!phone,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

### 9.6 Audit Log Query: Recent Auth Activity

```sql
-- View last 50 auth events with project info
SELECT
  tal.created_at,
  tal.action,
  tal.success,
  tal.failure_reason,
  tal.ip_address,
  p.project_no,
  p.client_name,
  tal.metadata
FROM token_audit_log tal
LEFT JOIN asi360_projects p ON p.id = tal.project_id
ORDER BY tal.created_at DESC
LIMIT 50;
```

```sql
-- Failed attempts in last 24 hours grouped by project
SELECT
  p.project_no,
  p.client_name,
  count(*) as failure_count,
  max(tal.created_at) as last_failure,
  array_agg(DISTINCT tal.ip_address) as ips
FROM token_audit_log tal
JOIN asi360_projects p ON p.id = tal.project_id
WHERE tal.action = 'token_validation_failed'
  AND tal.created_at > now() - interval '24 hours'
GROUP BY p.project_no, p.client_name
ORDER BY failure_count DESC;
```

```sql
-- Projects with active tokens expiring in next 7 days
SELECT
  p.project_no,
  p.client_name,
  p.contact_phone,
  t.token_hint,
  t.expires_at,
  t.access_count,
  t.last_accessed_at
FROM project_access_tokens t
JOIN asi360_projects p ON p.id = t.project_id
WHERE t.is_active = true
  AND t.expires_at BETWEEN now() AND now() + interval '7 days'
ORDER BY t.expires_at ASC;
```

---

## 10. Testing Plan

### 10.1 Unit Tests (SQL Functions)

```sql
-- Test Suite: generate_project_token
-- Run against a test project

-- Setup: create a test project
INSERT INTO asi360_projects (id, project_no, project_name, client_name, contact_phone, status)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'PROJ-TEST-0001',
  'Test Project',
  'Test Client',
  '+15105551234',
  'initiated'
);

-- Test 1: Generate a client_readonly token
DO $$
DECLARE v_pin text;
BEGIN
  v_pin := generate_project_token(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'client_readonly', 90, '+15105551234', NULL, 'test'
  );
  ASSERT length(v_pin) = 6, 'PIN must be 6 digits';
  ASSERT v_pin ~ '^\d{6}$', 'PIN must be numeric';
  RAISE NOTICE 'Test 1 PASSED: PIN = %', v_pin;
END;
$$;

-- Test 2: Validate correct PIN
DO $$
DECLARE
  v_pin text;
  v_result jsonb;
BEGIN
  v_pin := generate_project_token(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'client_readonly', 90, NULL, NULL, 'test'
  );
  v_result := validate_project_token('PROJ-TEST-0001', v_pin);
  ASSERT (v_result->>'valid')::boolean = true, 'Valid PIN must return valid=true';
  ASSERT v_result->>'token_type' = 'client_readonly', 'Token type must match';
  RAISE NOTICE 'Test 2 PASSED: %', v_result;
END;
$$;

-- Test 3: Reject wrong PIN
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := validate_project_token('PROJ-TEST-0001', '000000');
  ASSERT (v_result->>'valid')::boolean = false, 'Invalid PIN must return valid=false';
  RAISE NOTICE 'Test 3 PASSED: %', v_result;
END;
$$;

-- Test 4: Reject nonexistent project
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := validate_project_token('PROJ-FAKE-9999', '123456');
  ASSERT (v_result->>'valid')::boolean = false, 'Nonexistent project must return valid=false';
  ASSERT v_result->>'error' = 'invalid_credentials', 'Must not reveal project existence';
  RAISE NOTICE 'Test 4 PASSED: %', v_result;
END;
$$;

-- Test 5: Rate limiting kicks in after 5 failures
DO $$
DECLARE
  v_result jsonb;
  i integer;
BEGIN
  -- Generate 5 failures
  FOR i IN 1..5 LOOP
    v_result := validate_project_token('PROJ-TEST-0001', '000001');
  END LOOP;
  -- 6th attempt should be rate-limited
  v_result := validate_project_token('PROJ-TEST-0001', '000002');
  ASSERT v_result->>'error' = 'rate_limited', '6th failure must trigger rate limit';
  RAISE NOTICE 'Test 5 PASSED: %', v_result;
END;
$$;

-- Test 6: Revoke token
DO $$
DECLARE
  v_pin text;
  v_token_id uuid;
  v_revoked boolean;
  v_result jsonb;
BEGIN
  v_pin := generate_project_token(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'client_readonly', 90, NULL, NULL, 'test'
  );
  SELECT id INTO v_token_id
  FROM project_access_tokens
  WHERE project_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    AND is_active = true
  ORDER BY created_at DESC LIMIT 1;

  v_revoked := revoke_project_token(v_token_id, 'test');
  ASSERT v_revoked = true, 'Revoke must return true';

  -- Try to validate with the revoked token's PIN
  v_result := validate_project_token('PROJ-TEST-0001', v_pin);
  ASSERT (v_result->>'valid')::boolean = false, 'Revoked token must not validate';
  RAISE NOTICE 'Test 6 PASSED';
END;
$$;

-- Cleanup
DELETE FROM token_audit_log WHERE project_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM project_access_tokens WHERE project_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM asi360_projects WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
```

### 10.2 Edge Function Integration Tests

```bash
# Test /auth/lookup -- existing project
curl -s -X POST https://gtfffxwfgcxiiauliynd.supabase.co/functions/v1/project-portal-auth/auth/lookup \
  -H "Content-Type: application/json" \
  -d '{"project_no":"PROJ-202603-1234"}' | jq .

# Test /auth/lookup -- nonexistent project
curl -s -X POST https://gtfffxwfgcxiiauliynd.supabase.co/functions/v1/project-portal-auth/auth/lookup \
  -H "Content-Type: application/json" \
  -d '{"project_no":"PROJ-999999-0000"}' | jq .

# Test /auth/validate -- valid credentials
curl -s -X POST https://gtfffxwfgcxiiauliynd.supabase.co/functions/v1/project-portal-auth/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"project_no":"PROJ-202603-1234","pin":"482917"}' | jq .

# Test /auth/validate -- invalid PIN
curl -s -X POST https://gtfffxwfgcxiiauliynd.supabase.co/functions/v1/project-portal-auth/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"project_no":"PROJ-202603-1234","pin":"000000"}' | jq .

# Test /auth/refresh -- with valid JWT
TOKEN="eyJ..."
curl -s -X POST https://gtfffxwfgcxiiauliynd.supabase.co/functions/v1/project-portal-auth/auth/refresh \
  -H "Authorization: Bearer ${TOKEN}" | jq .

# Test /auth/request-pin
curl -s -X POST https://gtfffxwfgcxiiauliynd.supabase.co/functions/v1/project-portal-auth/auth/request-pin \
  -H "Content-Type: application/json" \
  -d '{"project_no":"PROJ-202603-1234","phone":"+15105551234"}' | jq .
```

---

## 11. Migration Checklist

Execute in order:

```
[ ] 1. Verify pgcrypto extension is enabled:
      SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

[ ] 2. Verify asi360_projects table exists with required columns:
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'asi360_projects';

[ ] 3. Run migration: CREATE TABLE project_access_tokens (Section 3.1)

[ ] 4. Run migration: CREATE TABLE token_audit_log (Section 3.1)

[ ] 5. Apply RLS policies (Section 3.2)

[ ] 6. Create function: generate_project_token (Section 4.1)

[ ] 7. Create function: validate_project_token (Section 4.2)

[ ] 8. Create function: revoke_project_token (Section 4.3)

[ ] 9. Create function: check_rate_limit (Section 4.4)

[ ] 10. Create function: check_rate_limit_by_ip (Section 4.5)

[ ] 11. Create function: request_token_via_sms (Section 4.6)

[ ] 12. Create function: sweep_expired_tokens (Section 3.3)

[ ] 13. Add supabase_jwt_secret to Vault (if not present):
       SELECT vault.create_secret('supabase_jwt_secret', '<jwt_secret>', 'JWT signing key for portal auth');

[ ] 14. Deploy Edge Function: project-portal-auth (Section 6)
       supabase functions deploy project-portal-auth --no-verify-jwt

[ ] 15. Deploy Edge Function: airtable-generate-token (Section 9.5)
       supabase functions deploy airtable-generate-token --no-verify-jwt

[ ] 16. Run test suite (Section 10.1)

[ ] 17. Test Edge Function endpoints (Section 10.2)

[ ] 18. Configure pg_cron for daily sweep_expired_tokens():
       SELECT cron.schedule('sweep-expired-tokens', '0 3 * * *', 'SELECT sweep_expired_tokens()');
```

---

## Appendix A: Error Code Reference

| Error Code | HTTP Status | Description |
|---|---|---|
| `missing_field` | 400 | Required field not provided |
| `missing_fields` | 400 | Multiple required fields not provided |
| `invalid_format` | 400 | Project number format invalid |
| `invalid_pin_format` | 400 | PIN is not exactly 6 digits |
| `invalid_phone` | 400 | Phone format invalid |
| `invalid_credentials` | 401 | Project/PIN combination invalid (generic) |
| `unauthorized` | 401 | Bearer token missing or invalid |
| `invalid_token` | 401 | JWT expired or tampered |
| `token_revoked` | 401 | Underlying access token was revoked |
| `rate_limited` | 429 | Too many failed attempts |
| `method_not_allowed` | 405 | Only POST accepted |
| `not_found` | 404 | Unknown endpoint |
| `internal_error` | 500 | Unexpected server error |

## Appendix B: JWT Anatomy

```
Header (Base64URL):
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload (Base64URL):
{
  "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // project_id
  "project_no": "PROJ-202603-1234",
  "project_name": "Goldman Law Firm -- Access Control",
  "token_type": "client_readonly",                   // or "admin_full"
  "token_id": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
  "iss": "asi360-portal",
  "aud": "projects.asi360.co",
  "iat": 1710000000,
  "exp": 1710086400                                  // +24 hours
}

Signature:
HMAC-SHA256(base64url(header) + "." + base64url(payload), supabase_jwt_secret)
```

---

*End of Module 1: Authentication & Token System*
