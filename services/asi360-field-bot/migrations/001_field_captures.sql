-- ASI360 Field Capture Bot — schema
-- Run against: gtfffxwfgcxiiauliynd (asi360-commerce)

-- Photo/media captures from the field
CREATE TABLE IF NOT EXISTS field_captures (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         bigint NOT NULL,
    user_name       text,
    mode            text NOT NULL CHECK (mode IN ('note','task','work_order','batch','maintenance')),
    photo_path      text,                   -- local droplet path
    gdrive_file_id  text,                   -- Google Drive file ID
    gdrive_url      text,                   -- public/shared URL
    file_size_bytes integer,
    ai_summary      text,                   -- Claude Vision summary
    ai_tags         text[],                 -- AI-generated searchable tags
    extracted_data  jsonb DEFAULT '{}',      -- mode-specific structured output
    raw_text        text,                   -- OCR / transcription
    caption         text,                   -- user-provided text/voice note
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','processed','failed','archived')),
    batch_id        uuid,                   -- links batch photos together
    linked_airtable_id  text,               -- Airtable record ID if synced
    linked_supabase_id  uuid,               -- FK to tasks/work orders if created
    created_at      timestamptz NOT NULL DEFAULT now(),
    processed_at    timestamptz
);

CREATE INDEX idx_fc_chat_id ON field_captures(chat_id);
CREATE INDEX idx_fc_mode ON field_captures(mode);
CREATE INDEX idx_fc_status ON field_captures(status);
CREATE INDEX idx_fc_batch ON field_captures(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_fc_tags ON field_captures USING GIN(ai_tags);
CREATE INDEX idx_fc_created ON field_captures(created_at DESC);

-- Bot conversation sessions for memory
CREATE TABLE IF NOT EXISTS bot_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         bigint NOT NULL,
    user_name       text,
    current_mode    text DEFAULT 'note',
    context         jsonb DEFAULT '{}',     -- conversation memory
    batch_id        uuid,                   -- active batch if in batch mode
    last_active     timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_bs_chat_id ON bot_sessions(chat_id);
