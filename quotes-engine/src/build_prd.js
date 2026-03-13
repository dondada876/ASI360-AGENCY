const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak,
  PageNumber, TabStopType, TabStopPosition
} = require("docx");

// ─── CONFIG ───
const BLUE    = "0B5394";
const TEAL    = "45818E";
const ORANGE  = "B85B22";
const GREEN   = "38761D";
const PURPLE  = "351C75";
const GRAY    = "434343";
const LTBLUE  = "D6E4F0";
const LTGRAY  = "F2F2F2";
const WHITE   = "FFFFFF";
const BLACK   = "222222";

const PAGE_W = 12240;  // US Letter
const PAGE_H = 15840;
const MARGIN = 1440;   // 1 inch
const CONTENT_W = PAGE_W - (MARGIN * 2); // 9360

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const cellPad = { top: 60, bottom: 60, left: 100, right: 100 };
const headerPad = { top: 80, bottom: 80, left: 100, right: 100 };

// ─── HELPERS ───
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, children: [new TextRun(text)] });
}

function para(text, opts = {}) {
  const runOpts = { text, font: "Arial", size: 22, ...opts };
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun(runOpts)],
    ...(opts.alignment && { alignment: opts.alignment }),
  });
}

function boldPara(text, opts = {}) {
  return para(text, { bold: true, ...opts });
}

function bullet(text, ref = "bullets", level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function numberItem(text, ref = "numbers", level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function headerCell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts.fill || BLUE, type: ShadingType.CLEAR },
    margins: headerPad,
    verticalAlign: "center",
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, bold: true, font: "Arial", size: 20, color: WHITE })]
    })],
  });
}

function dataCell(text, width, opts = {}) {
  const runs = [];
  if (opts.label) {
    runs.push(new TextRun({ text: opts.label, bold: true, font: "Arial", size: 20, color: BLACK }));
    runs.push(new TextRun({ text: " " + text, font: "Arial", size: 20, color: opts.color || "444444" }));
  } else {
    runs.push(new TextRun({ text, font: "Arial", size: 20, color: opts.color || "444444", bold: opts.bold || false }));
  }
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: opts.fill || WHITE, type: ShadingType.CLEAR },
    margins: cellPad,
    children: [new Paragraph({ children: runs })],
  });
}

function spacer(h = 200) {
  return new Paragraph({ spacing: { after: h }, children: [] });
}

function sectionHeader(text, color = BLUE) {
  return new Paragraph({
    spacing: { before: 300, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 4 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, font: "Arial", size: 24, color })],
  });
}

function codeBlock(lines) {
  return lines.map(line => new Paragraph({
    spacing: { after: 20 },
    children: [new TextRun({ text: line, font: "Courier New", size: 18, color: "333333" })],
  }));
}

// ─── BUILD DOCUMENT ───

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: TEAL },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: GRAY },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }, {
          level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "phase-numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "api-numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "deploy-numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [

    // ═══════════════════════════════════════════════════════════
    // COVER PAGE
    // ═══════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } },
            children: [
              new TextRun({ text: "ASI 360", bold: true, font: "Arial", size: 18, color: BLUE }),
              new TextRun({ text: "  |  CONFIDENTIAL", font: "Arial", size: 16, color: "999999" }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC", space: 4 } },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: "Allied Systems Integrations 360  |  (510) 288-0994  |  ops@asi360.co", font: "Arial", size: 16, color: "999999" }),
              new TextRun({ text: "\tPage ", font: "Arial", size: 16, color: "999999" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" }),
            ],
          })],
        }),
      },
      children: [
        spacer(1800),

        // Title block
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "PRODUCT REQUIREMENTS DOCUMENT", font: "Arial", size: 20, color: "888888", bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: "ASI 360 Project Status Portal", font: "Arial", size: 52, bold: true, color: BLUE })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Live Customer-Facing Project Tracking with Gantt Timeline", font: "Arial", size: 24, color: "666666", italics: true })],
        }),

        // Meta table
        new Table({
          width: { size: 5400, type: WidthType.DXA },
          columnWidths: [2200, 3200],
          alignment: AlignmentType.CENTER,
          rows: [
            ["Document", "PRD-PORTAL-001"],
            ["Version", "1.0"],
            ["Date", "March 10, 2026"],
            ["Author", "Don Bucknor / Claude"],
            ["Status", "DRAFT \u2014 Ready for Approval"],
            ["Classification", "Internal \u2014 Confidential"],
          ].map(([label, value]) =>
            new TableRow({
              children: [
                new TableCell({
                  borders, width: { size: 2200, type: WidthType.DXA },
                  shading: { fill: LTBLUE, type: ShadingType.CLEAR }, margins: cellPad,
                  children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: "Arial", size: 20, color: BLUE })] })],
                }),
                new TableCell({
                  borders, width: { size: 3200, type: WidthType.DXA }, margins: cellPad,
                  children: [new Paragraph({ children: [new TextRun({ text: value, font: "Arial", size: 20 })] })],
                }),
              ],
            })
          ),
        }),

        spacer(600),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "projects.asi360.co", font: "Arial", size: 28, bold: true, color: TEAL })],
        }),

        // ═══ PAGE BREAK ═══
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════════════════════════════════════════════
        // 1. EXECUTIVE SUMMARY
        // ═══════════════════════════════════════════════════════════
        heading("1. Executive Summary"),

        para("ASI 360 needs a customer-facing project status portal where clients can look up their security integration project, authenticate with a PIN, and view a live Gantt timeline showing current phase progress, task completion, and payment milestones."),

        para("This PRD defines the spec-driven development plan for projects.asi360.co \u2014 a lightweight React SPA backed by Supabase, with real-time data from the existing 3-tier sync architecture (Supabase \u2192 Airtable \u2192 VTiger)."),

        spacer(100),

        heading("1.1 Why NOT WordPress", HeadingLevel.HEADING_2),
        para("WordPress is the wrong tool for a data-driven portal. Here\u2019s the comparison:"),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2200, 3580, 3580],
          rows: [
            new TableRow({ children: [
              headerCell("Criteria", 2200),
              headerCell("WordPress", 3580, { fill: ORANGE }),
              headerCell("React + Supabase", 3580, { fill: GREEN }),
            ]}),
            ...([
              ["Build Time", "12\u201316 hrs (custom theme, API plugin, auth plugin)", "6\u20138 hrs (direct Supabase SDK, reuse Gantt CSS)"],
              ["Performance", "PHP rendering + DB queries per request", "Static build + client-side API calls"],
              ["Auth", "WordPress user system (overkill)", "Supabase RLS + PIN tokens (purpose-built)"],
              ["Maintenance", "Plugin updates, security patches, PHP version", "Zero server maintenance (static files)"],
              ["Security", "Large attack surface (wp-admin, xmlrpc, plugins)", "Minimal surface (static files + API)"],
              ["Data Source", "Needs custom plugin for Supabase API", "Native Supabase JS SDK (already exists)"],
              ["Scalability", "PHP workers, MySQL connections", "CDN-ready static files, Supabase handles scale"],
              ["Verdict", "\u274C Overengineered", "\u2705 Purpose-built"],
            ]).map(([crit, wp, react]) =>
              new TableRow({ children: [
                dataCell(crit, 2200, { bold: true, fill: LTGRAY }),
                dataCell(wp, 3580),
                dataCell(react, 3580),
              ]})
            ),
          ],
        }),

        spacer(200),

        // ═══════════════════════════════════════════════════════════
        // 2. ARCHITECTURE
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("2. System Architecture"),

        heading("2.1 Three-Tier Data Model", HeadingLevel.HEADING_2),
        para("Each system serves a distinct role. There is NO data duplication \u2014 each tier owns its domain:"),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [1800, 2520, 2520, 2520],
          rows: [
            new TableRow({ children: [
              headerCell("Tier", 1800),
              headerCell("System", 2520),
              headerCell("Role", 2520),
              headerCell("Owns", 2520),
            ]}),
            ...([
              ["Source of Truth", "Supabase", "Canonical project state, auth tokens, task status", "asi360_projects, asi360_project_tasks, project_access_tokens"],
              ["Operational", "Airtable", "Team drag-drop workflows, visual Kanban, daily ops", "ASI 360 Projects base (Projects, Tasks tables)"],
              ["CRM / Archival", "VTiger", "Client records, quotes, invoices, formal project history", "Projects module, Quotes, Contacts"],
              ["Customer Portal", "React SPA", "Client-facing read-only view with live Gantt timeline", "Static build on Nginx \u2014 no data storage"],
            ]).map(([tier, sys, role, owns]) =>
              new TableRow({ children: [
                dataCell(tier, 1800, { bold: true, fill: LTBLUE }),
                dataCell(sys, 2520, { bold: true }),
                dataCell(role, 2520),
                dataCell(owns, 2520, { color: "666666" }),
              ]})
            ),
          ],
        }),

        spacer(200),
        heading("2.2 Data Flow Diagram", HeadingLevel.HEADING_2),
        para("All status updates flow through the Gateway API, which syncs all three systems simultaneously:"),
        spacer(80),

        ...codeBlock([
          "                        \u250C\u2500\u2500\u2500 OPS TEAM \u2500\u2500\u2500\u2510",
          "                        \u2502                \u2502",
          "                \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250C\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2510",
          "                \u2502   AIRTABLE    \u2502  \u2502  CLAUDE   \u2502",
          "                \u2502  (drag+drop)  \u2502  \u2502  (MCP)    \u2502",
          "                \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2518",
          "                  webhook\u2502              \u2502gateway",
          "                        \u25BC              \u25BC",
          "             \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
          "             \u2502    SUPABASE (Truth)       \u2502",
          "             \u2502  asi360_projects          \u2502",
          "             \u2502  asi360_project_tasks      \u2502",
          "             \u2502  project_access_tokens     \u2502",
          "             \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
          "                     \u2502        \u2502",
          "              \u250C\u2500\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2510 \u250C\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2500\u2510",
          "              \u2502 VTIGER  \u2502 \u2502 REACT   \u2502",
          "              \u2502 (CRM)   \u2502 \u2502 PORTAL  \u2502",
          "              \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2518",
          "                             \u2502",
          "                       \u250C\u2500\u2500\u2500\u2500\u25BC\u2500\u2500\u2500\u2500\u2510",
          "                       \u2502 CLIENT  \u2502",
          "                       \u2502 BROWSER \u2502",
          "                       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
        ]),

        // ═══════════════════════════════════════════════════════════
        // 3. TECH STACK
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("3. Technology Stack"),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2000, 2500, 4860],
          rows: [
            new TableRow({ children: [
              headerCell("Layer", 2000),
              headerCell("Technology", 2500),
              headerCell("Rationale", 4860),
            ]}),
            ...([
              ["Frontend", "React 18 + Vite", "Fast builds, already used in 500GrandLive packages, Tailwind for styling"],
              ["CSS", "Tailwind CSS + Custom Gantt CSS", "Gantt chart CSS already built (timeline.html), Tailwind for layout/forms"],
              ["State", "React Query (TanStack)", "Auto-refetch, caching, loading states for API calls"],
              ["Auth", "Supabase JS SDK + PIN tokens", "No user accounts needed \u2014 simple project_no + access_token validation"],
              ["API", "Supabase Edge Function", "Serverless, auto-scaling, no server to maintain, RLS for security"],
              ["Database", "Supabase PostgreSQL", "Already the source of truth (asi360_projects, asi360_project_tasks)"],
              ["Hosting", "Nginx on Droplet (104.248.69.86)", "Static build served via Nginx, same as gl-ops-dashboard pattern"],
              ["Domain", "projects.asi360.co", "A record \u2192 104.248.69.86, Nginx server block, Let\u2019s Encrypt SSL"],
              ["PDF Export", "Playwright (Chromium headless)", "Already installed, already generates the timeline PDF we built"],
              ["Sync", "Gateway API (existing)", "update_project_task already syncs Supabase \u2192 Airtable \u2192 VTiger"],
            ]).map(([layer, tech, why]) =>
              new TableRow({ children: [
                dataCell(layer, 2000, { bold: true, fill: LTGRAY }),
                dataCell(tech, 2500, { bold: true }),
                dataCell(why, 4860),
              ]})
            ),
          ],
        }),

        spacer(200),
        heading("3.1 Subdomain & DNS", HeadingLevel.HEADING_2),
        boldPara("Subdomain: projects.asi360.co"),
        spacer(50),
        para("DNS Configuration (create in your registrar):"),
        ...codeBlock([
          "Type:  A",
          "Name:  projects",
          "Value: 104.248.69.86",
          "TTL:   3600",
        ]),
        spacer(100),
        para("Once DNS propagates, the droplet Nginx will serve the React build and Certbot will provision SSL."),

        // ═══════════════════════════════════════════════════════════
        // 4. DATABASE SCHEMA
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("4. Database Schema"),

        heading("4.1 Existing Tables (No Changes)", HeadingLevel.HEADING_2),
        para("These tables already exist in Supabase (asi360-commerce) and require no modifications:"),
        bullet("asi360_projects \u2014 5 active projects with full metadata"),
        bullet("asi360_project_tasks \u2014 102 tasks across all projects with status tracking"),
        bullet("asi360_project_templates \u2014 5 business type templates"),
        bullet("asi360_template_tasks \u2014 100 template task definitions"),

        spacer(100),
        heading("4.2 New Table: project_access_tokens", HeadingLevel.HEADING_2),
        para("Purpose: Client authentication for the portal. Each project gets a unique 6-digit PIN that the client uses to access their project status."),
        spacer(80),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2000, 1800, 1200, 4360],
          rows: [
            new TableRow({ children: [
              headerCell("Column", 2000),
              headerCell("Type", 1800),
              headerCell("Nullable", 1200),
              headerCell("Description", 4360),
            ]}),
            ...([
              ["id", "SERIAL PK", "NO", "Auto-increment primary key"],
              ["project_id", "INT REFERENCES asi360_projects(id)", "NO", "FK to the project"],
              ["access_token", "TEXT", "NO", "Hashed 6-digit PIN (pgcrypto crypt)"],
              ["token_plain_hint", "TEXT", "YES", "Last 2 digits hint (e.g., '**XX') for support"],
              ["client_phone", "TEXT", "YES", "Phone for SMS delivery of PIN"],
              ["client_email", "TEXT", "YES", "Email for PIN delivery"],
              ["is_active", "BOOLEAN DEFAULT true", "NO", "Disable without deleting"],
              ["expires_at", "TIMESTAMPTZ", "YES", "Optional expiry (NULL = never)"],
              ["last_accessed_at", "TIMESTAMPTZ", "YES", "Track last portal visit"],
              ["access_count", "INT DEFAULT 0", "NO", "Track total portal visits"],
              ["created_at", "TIMESTAMPTZ DEFAULT now()", "NO", "Token creation timestamp"],
            ]).map(([col, type, nullable, desc]) =>
              new TableRow({ children: [
                dataCell(col, 2000, { bold: true }),
                dataCell(type, 1800, { color: "666666" }),
                dataCell(nullable, 1200),
                dataCell(desc, 4360),
              ]})
            ),
          ],
        }),

        spacer(100),
        heading("4.3 Migration SQL", HeadingLevel.HEADING_2),
        ...codeBlock([
          "-- Migration: create_project_access_tokens",
          "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
          "",
          "CREATE TABLE public.project_access_tokens (",
          "  id            SERIAL PRIMARY KEY,",
          "  project_id    INT NOT NULL REFERENCES asi360_projects(id),",
          "  access_token  TEXT NOT NULL,",
          "  token_plain_hint TEXT,",
          "  client_phone  TEXT,",
          "  client_email  TEXT,",
          "  is_active     BOOLEAN NOT NULL DEFAULT true,",
          "  expires_at    TIMESTAMPTZ,",
          "  last_accessed_at TIMESTAMPTZ,",
          "  access_count  INT NOT NULL DEFAULT 0,",
          "  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()",
          ");",
          "",
          "CREATE INDEX idx_pat_project ON project_access_tokens(project_id);",
          "CREATE INDEX idx_pat_active ON project_access_tokens(is_active);",
          "",
          "ALTER TABLE project_access_tokens ENABLE ROW LEVEL SECURITY;",
          "",
          "-- RPC: Validate token and return project data",
          "CREATE OR REPLACE FUNCTION public.validate_project_token(",
          "  p_project_no TEXT,",
          "  p_token TEXT",
          ") RETURNS JSON",
          "LANGUAGE plpgsql SECURITY DEFINER AS $$",
          "DECLARE",
          "  v_project RECORD;",
          "  v_token RECORD;",
          "BEGIN",
          "  -- Find project",
          "  SELECT * INTO v_project FROM asi360_projects",
          "  WHERE project_no = p_project_no;",
          "  IF NOT FOUND THEN",
          "    RETURN json_build_object('valid', false, 'error', 'Project not found');",
          "  END IF;",
          "",
          "  -- Validate token",
          "  SELECT * INTO v_token FROM project_access_tokens",
          "  WHERE project_id = v_project.id",
          "    AND is_active = true",
          "    AND access_token = crypt(p_token, access_token)",
          "    AND (expires_at IS NULL OR expires_at > now());",
          "  IF NOT FOUND THEN",
          "    RETURN json_build_object('valid', false, 'error', 'Invalid PIN');",
          "  END IF;",
          "",
          "  -- Update access tracking",
          "  UPDATE project_access_tokens",
          "  SET last_accessed_at = now(), access_count = access_count + 1",
          "  WHERE id = v_token.id;",
          "",
          "  RETURN json_build_object('valid', true, 'project_id', v_project.id);",
          "END;",
          "$$;",
        ]),

        spacer(100),
        heading("4.4 New Table: project_timeline_config", HeadingLevel.HEADING_2),
        para("Purpose: Stores the Gantt bar layout configuration per project, enabling the live timeline view to render correctly. This is the same JSON structure as example_project.json."),
        spacer(80),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2000, 2000, 1200, 4160],
          rows: [
            new TableRow({ children: [
              headerCell("Column", 2000),
              headerCell("Type", 2000),
              headerCell("Nullable", 1200),
              headerCell("Description", 4160),
            ]}),
            ...([
              ["id", "SERIAL PK", "NO", "Auto-increment"],
              ["project_id", "INT REFERENCES asi360_projects(id) UNIQUE", "NO", "One config per project"],
              ["periods", "JSONB", "NO", 'Week labels: [{"label":"WEEK 1","span":5}]'],
              ["day_labels", "JSONB", "NO", 'Day labels: ["MON","TUE",...]'],
              ["phases", "JSONB", "NO", "Phase + task Gantt bar definitions with bar_start, bar_end, bar_label"],
              ["notes", "JSONB", "YES", "Note cards (Delivery Strategy, Payment Milestones, Scope)"],
              ["created_at", "TIMESTAMPTZ DEFAULT now()", "NO", ""],
              ["updated_at", "TIMESTAMPTZ DEFAULT now()", "NO", ""],
            ]).map(([col, type, nullable, desc]) =>
              new TableRow({ children: [
                dataCell(col, 2000, { bold: true }),
                dataCell(type, 2000, { color: "666666" }),
                dataCell(nullable, 1200),
                dataCell(desc, 4160),
              ]})
            ),
          ],
        }),

        // ═══════════════════════════════════════════════════════════
        // 5. API SPECIFICATION
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("5. API Specification"),

        heading("5.1 Supabase Edge Function: project-status", HeadingLevel.HEADING_2),
        para("A single Edge Function handles all portal API needs. Deployed to the asi360-commerce Supabase project."),

        spacer(80),
        sectionHeader("Endpoint 1: Validate Token", TEAL),
        ...codeBlock([
          "POST /functions/v1/project-status/auth",
          "",
          "Request:",
          '  { "project_no": "PROJ-202603-5336", "pin": "482917" }',
          "",
          "Response (200):",
          '  { "valid": true, "session_token": "jwt...", "project_id": 1 }',
          "",
          "Response (401):",
          '  { "valid": false, "error": "Invalid PIN" }',
        ]),

        spacer(100),
        sectionHeader("Endpoint 2: Get Project Status", TEAL),
        ...codeBlock([
          "GET /functions/v1/project-status/status",
          "Authorization: Bearer <session_token>",
          "",
          "Response (200):",
          "  {",
          '    "project": {',
          '      "project_no": "PROJ-202603-5336",',
          '      "project_name": "Goldman Law Firm \u2014 Access Control",',
          '      "client_name": "Goldman Law Firm",',
          '      "current_phase": 1,',
          '      "progress_pct": 15,',
          '      "start_date": "2026-03-10",',
          '      "target_close_date": "2026-04-30"',
          "    },",
          '    "phases": [',
          '      { "phase_no": 1, "name": "Conception & Initiation",',
          '        "complete": 1, "total": 3, "progress_pct": 33 },',
          "      ...",
          "    ],",
          '    "timeline_config": { ... },  // Gantt bar layout',
          '    "last_updated": "2026-03-10T14:30:00Z"',
          "  }",
        ]),

        spacer(100),
        sectionHeader("Endpoint 3: Download PDF", TEAL),
        ...codeBlock([
          "GET /functions/v1/project-status/pdf",
          "Authorization: Bearer <session_token>",
          "",
          "Response: application/pdf binary",
          "(Generates PDF using the same HTML template + Playwright)",
        ]),

        spacer(200),
        heading("5.2 Auth Flow", HeadingLevel.HEADING_2),
        para("PIN-based authentication \u2014 no user accounts, no passwords, no OAuth:"),
        spacer(60),
        numberItem("Ops team creates project via Gateway API (create_project_from_template)", "api-numbers"),
        numberItem("System generates random 6-digit PIN, stores hashed in project_access_tokens", "api-numbers"),
        numberItem("PIN is sent to client via SMS (Twilio) and/or email", "api-numbers"),
        numberItem("Client visits projects.asi360.co, enters Project No + PIN", "api-numbers"),
        numberItem("Edge Function validates via validate_project_token() RPC", "api-numbers"),
        numberItem("On success, returns a short-lived JWT (24hr expiry) for subsequent API calls", "api-numbers"),
        numberItem("Client sees live Gantt timeline, phase progress, project details", "api-numbers"),
        numberItem("Client can request new PIN anytime (resent via SMS)", "api-numbers"),

        // ═══════════════════════════════════════════════════════════
        // 6. FRONTEND SPECIFICATION
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("6. Frontend Specification"),

        heading("6.1 Page Map (3 Views)", HeadingLevel.HEADING_2),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [1600, 2400, 5360],
          rows: [
            new TableRow({ children: [
              headerCell("Route", 1600),
              headerCell("View", 2400),
              headerCell("Description", 5360),
            ]}),
            ...([
              ["/", "Lookup Screen", "Clean branded form: Project No input, PIN input, Submit button. ASI 360 logo + tagline. Error states for invalid PIN."],
              ["/status", "Project Dashboard", "Phase progress bars (5 phases), overall completion %, project metadata (client, dates, manager), live Gantt chart, PDF download button."],
              ["/status/timeline", "Full Gantt View", "Full-width interactive Gantt chart matching the PDF layout. Phase colors, bar labels, notes cards. Responsive (works on mobile)."],
            ]).map(([route, view, desc]) =>
              new TableRow({ children: [
                dataCell(route, 1600, { bold: true }),
                dataCell(view, 2400, { bold: true }),
                dataCell(desc, 5360),
              ]})
            ),
          ],
        }),

        spacer(200),
        heading("6.2 Lookup Screen (/) ", HeadingLevel.HEADING_2),
        para("The entry point. Clean, professional, branded."),
        spacer(60),
        bullet("ASI 360 logo centered at top"),
        bullet('Tagline: "One Company.. Unlimited Solutions.."'),
        bullet("Two input fields: Project Number (text, placeholder: PROJ-XXXXXX-XXXX) and Access PIN (6-digit numeric, masked)"),
        bullet('"View Project Status" button \u2014 primary blue (#0B5394)'),
        bullet("Error toast for invalid credentials"),
        bullet('"Request New PIN" link \u2192 triggers SMS resend'),
        bullet("Footer: ASI 360 contact info + confidential notice"),

        spacer(200),
        heading("6.3 Project Dashboard (/status)", HeadingLevel.HEADING_2),
        para("The main view after authentication. Shows project health at a glance."),
        spacer(60),

        boldPara("Header Bar:"),
        bullet("Project name (large)"),
        bullet("Client name + contact"),
        bullet("Overall progress ring/bar (e.g., 15% complete)"),
        bullet("Project status badge (Initiated / In Progress / On Hold / Completed)"),

        spacer(80),
        boldPara("Phase Progress Section:"),
        bullet("5 horizontal progress bars, one per phase"),
        bullet("Phase color matches the Gantt chart (#0B5394, #45818E, #B85B22, #38761D, #351C75)"),
        bullet("Each bar shows: phase name, X/Y tasks complete, percentage"),
        bullet("Active phase is highlighted/expanded to show individual task statuses"),

        spacer(80),
        boldPara("Timeline Preview:"),
        bullet("Embedded Gantt chart (same CSS as the PDF template)"),
        bullet('"View Full Timeline" button \u2192 navigates to /status/timeline'),
        bullet('"Download PDF" button \u2192 calls Edge Function PDF endpoint'),

        spacer(80),
        boldPara("Project Details Card:"),
        bullet("Start date, target close date"),
        bullet("Contract value (optional \u2014 can be hidden per project)"),
        bullet("Quote references"),
        bullet("Project manager contact"),

        spacer(200),
        heading("6.4 Component Architecture", HeadingLevel.HEADING_2),
        ...codeBlock([
          "src/",
          "\u251C\u2500\u2500 App.jsx                    # Router + auth context",
          "\u251C\u2500\u2500 pages/",
          "\u2502   \u251C\u2500\u2500 LookupPage.jsx          # Project # + PIN form",
          "\u2502   \u251C\u2500\u2500 DashboardPage.jsx       # Phase progress + summary",
          "\u2502   \u2514\u2500\u2500 TimelinePage.jsx        # Full Gantt chart view",
          "\u251C\u2500\u2500 components/",
          "\u2502   \u251C\u2500\u2500 GanttChart.jsx          # Gantt table (port of timeline.html)",
          "\u2502   \u251C\u2500\u2500 PhaseProgress.jsx       # 5-phase progress bars",
          "\u2502   \u251C\u2500\u2500 ProjectHeader.jsx       # Name, status badge, ring",
          "\u2502   \u251C\u2500\u2500 NoteCards.jsx           # 3-column notes grid",
          "\u2502   \u2514\u2500\u2500 PinInput.jsx            # 6-digit PIN entry",
          "\u251C\u2500\u2500 hooks/",
          "\u2502   \u251C\u2500\u2500 useProjectStatus.js     # React Query hook for status API",
          "\u2502   \u2514\u2500\u2500 useAuth.js              # PIN validation + JWT storage",
          "\u251C\u2500\u2500 lib/",
          "\u2502   \u2514\u2500\u2500 supabase.js             # Supabase client init",
          "\u2514\u2500\u2500 styles/",
          "    \u2514\u2500\u2500 gantt.css               # Ported from timeline.html CSS",
        ]),

        // ═══════════════════════════════════════════════════════════
        // 7. DEPLOYMENT
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("7. Deployment Plan"),

        heading("7.1 Infrastructure Setup", HeadingLevel.HEADING_2),
        para("Follows the same pattern as gl-ops-dashboard (port 3200):"),
        spacer(60),
        numberItem("Create DNS A record: projects.asi360.co \u2192 104.248.69.86", "deploy-numbers"),
        numberItem("Create Nginx server block at /etc/nginx/sites-available/projects-portal", "deploy-numbers"),
        numberItem("Build React app locally: npm run build", "deploy-numbers"),
        numberItem("Deploy dist/ to /var/www/projects-portal/ on droplet", "deploy-numbers"),
        numberItem("Enable site: ln -s sites-available/projects-portal sites-enabled/", "deploy-numbers"),
        numberItem("Provision SSL: certbot --nginx -d projects.asi360.co", "deploy-numbers"),
        numberItem("Deploy Edge Function: supabase functions deploy project-status", "deploy-numbers"),

        spacer(200),
        heading("7.2 Nginx Configuration", HeadingLevel.HEADING_2),
        ...codeBlock([
          "server {",
          "    listen 80;",
          "    server_name projects.asi360.co;",
          "",
          "    root /var/www/projects-portal/dist;",
          "    index index.html;",
          "",
          "    location / {",
          "        try_files $uri $uri/ /index.html;  # SPA fallback",
          "    }",
          "",
          "    location /assets/ {",
          "        expires 30d;",
          "        add_header Cache-Control \"public, immutable\";",
          "    }",
          "",
          "    # Certbot will add SSL block automatically",
          "}",
        ]),

        spacer(200),
        heading("7.3 Git Workflow", HeadingLevel.HEADING_2),
        para("All code lives in the 500GrandLive monorepo or a new dedicated repo:"),
        spacer(60),
        ...codeBlock([
          "Repository: dondada876/asi360-project-portal",
          "",
          "Branches:",
          "  feature/<name>  \u2192  staging  \u2192  main (production)",
          "",
          "CI/CD (GitHub Actions):",
          "  on push to main:",
          "    1. npm run build",
          "    2. scp dist/ to droplet:/var/www/projects-portal/",
          "    3. Deploy Edge Function to Supabase",
        ]),

        // ═══════════════════════════════════════════════════════════
        // 8. IMPLEMENTATION PHASES
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("8. Implementation Phases"),

        para("Total estimated effort: 8\u201310 hours across 4 phases."),
        spacer(100),

        // Phase 1
        sectionHeader("Phase 1: Database & Auth (Est. 1.5 hrs)", BLUE),
        bullet("Run migration: create project_access_tokens table"),
        bullet("Create validate_project_token() RPC function"),
        bullet("Generate PIN for Goldman project (first test case)"),
        bullet("Send PIN to Zachary Stewart via SMS"),
        bullet("Create project_timeline_config table"),
        bullet("Insert Goldman timeline config (from example_project.json)"),
        spacer(60),
        para("Deliverable: Goldman project accessible via PIN validation in Supabase.", { italics: true, color: "666666" }),

        spacer(200),
        // Phase 2
        sectionHeader("Phase 2: Edge Function API (Est. 2 hrs)", TEAL),
        bullet("Deploy project-status Edge Function with 3 endpoints"),
        bullet("/auth \u2014 validate PIN, return JWT"),
        bullet("/status \u2014 return project + phases + tasks + timeline config"),
        bullet("/pdf \u2014 generate and return PDF (using Playwright on droplet)"),
        bullet("Test all 3 endpoints with curl"),
        spacer(60),
        para("Deliverable: Working API that returns Goldman project data with PIN auth.", { italics: true, color: "666666" }),

        spacer(200),
        // Phase 3
        sectionHeader("Phase 3: React Portal (Est. 4\u20136 hrs)", ORANGE),
        bullet("Scaffold React + Vite + Tailwind project"),
        bullet("Build LookupPage (PIN form)"),
        bullet("Build DashboardPage (phase progress bars + summary)"),
        bullet("Port Gantt chart CSS from timeline.html to GanttChart.jsx"),
        bullet("Build TimelinePage (full interactive Gantt)"),
        bullet("Add PDF download button"),
        bullet("Responsive design (desktop + tablet + mobile)"),
        bullet("Build and deploy to droplet"),
        spacer(60),
        para("Deliverable: Live portal at projects.asi360.co showing Goldman project status.", { italics: true, color: "666666" }),

        spacer(200),
        // Phase 4
        sectionHeader("Phase 4: Airtable Sync + Polish (Est. 1 hr)", GREEN),
        bullet("Create Airtable automation: on task status change \u2192 webhook"),
        bullet("Webhook endpoint updates Supabase source of truth"),
        bullet("Portal reflects changes in real-time (React Query auto-refetch)"),
        bullet("QA: update task in Airtable \u2192 verify portal updates within 30 seconds"),
        spacer(60),
        para("Deliverable: End-to-end flow \u2014 Airtable status change \u2192 live portal update.", { italics: true, color: "666666" }),

        // ═══════════════════════════════════════════════════════════
        // 9. SECURITY
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("9. Security Considerations"),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2400, 6960],
          rows: [
            new TableRow({ children: [
              headerCell("Concern", 2400),
              headerCell("Mitigation", 6960),
            ]}),
            ...([
              ["PIN Storage", "Hashed with pgcrypto crypt() \u2014 never stored in plaintext"],
              ["API Auth", "Short-lived JWT (24hr) issued on PIN validation; all /status and /pdf calls require valid JWT"],
              ["Rate Limiting", "Edge Function enforces 5 auth attempts per minute per IP; lockout after 10 failures"],
              ["Data Exposure", "Portal shows read-only project data only; no access to other projects, costs, or internal notes"],
              ["HTTPS", "Enforced via Nginx + Let\u2019s Encrypt; HSTS header enabled"],
              ["CORS", "Edge Function allows only projects.asi360.co origin"],
              ["Input Validation", "Project number format validated (PROJ-XXXXXX-XXXX); PIN is exactly 6 digits"],
              ["Session Expiry", "JWT expires after 24 hours; client must re-enter PIN"],
            ]).map(([concern, mitigation]) =>
              new TableRow({ children: [
                dataCell(concern, 2400, { bold: true, fill: LTGRAY }),
                dataCell(mitigation, 6960),
              ]})
            ),
          ],
        }),

        // ═══════════════════════════════════════════════════════════
        // 10. SUCCESS METRICS
        // ═══════════════════════════════════════════════════════════
        spacer(300),
        heading("10. Success Metrics"),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [3000, 3180, 3180],
          rows: [
            new TableRow({ children: [
              headerCell("Metric", 3000),
              headerCell("Target", 3180),
              headerCell("Measurement", 3180),
            ]}),
            ...([
              ["Portal Load Time", "< 2 seconds", "Lighthouse performance score > 90"],
              ["Client Adoption", "100% of active projects", "Every new project gets a PIN automatically"],
              ["Support Calls Reduced", "50% fewer status inquiry calls", "Track call_logs for status-related calls"],
              ["Status Update Latency", "< 60 seconds", "Time from Airtable change to portal reflection"],
              ["Uptime", "99.9%", "Nginx on droplet + Supabase Edge Function"],
              ["PDF Generation", "< 5 seconds", "Time from button click to PDF download"],
            ]).map(([metric, target, measure]) =>
              new TableRow({ children: [
                dataCell(metric, 3000, { bold: true, fill: LTGRAY }),
                dataCell(target, 3180, { bold: true, color: GREEN }),
                dataCell(measure, 3180),
              ]})
            ),
          ],
        }),

        // ═══════════════════════════════════════════════════════════
        // 11. FUTURE ENHANCEMENTS
        // ═══════════════════════════════════════════════════════════
        spacer(300),
        heading("11. Future Enhancements (Post-MVP)"),

        bullet("SMS notifications \u2014 Auto-text client when project phase advances"),
        bullet("Photo attachments \u2014 Upload site photos to project timeline (before/after)"),
        bullet("Client approval workflow \u2014 Client signs off on phase completion in portal"),
        bullet("Multi-project view \u2014 Clients with multiple projects see a dashboard of all"),
        bullet("Payment integration \u2014 Show invoice status and accept payments via Stripe"),
        bullet("Real-time WebSocket \u2014 Supabase Realtime for instant updates without polling"),
        bullet("Mobile app \u2014 React Native wrapper for push notifications"),
        bullet("QR code access \u2014 Printed QR on project folder links directly to status page"),

        // ═══════════════════════════════════════════════════════════
        // APPROVAL
        // ═══════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        heading("12. Approval"),

        para("This PRD defines the complete specification for the ASI 360 Project Status Portal. Upon approval, development begins with Phase 1 (Database & Auth)."),
        spacer(200),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2340, 2340, 2340, 2340],
          rows: [
            new TableRow({ children: [
              headerCell("Role", 2340),
              headerCell("Name", 2340),
              headerCell("Date", 2340),
              headerCell("Signature", 2340),
            ]}),
            ...([
              ["CEO / Product Owner", "Don Bucknor", "", ""],
              ["Technical Lead", "Claude (AI)", "03/10/2026", "Auto-approved"],
              ["Project Manager", "Don Bucknor", "", ""],
            ]).map(([role, name, date, sig]) =>
              new TableRow({
                height: { value: 600, rule: "atLeast" },
                children: [
                  dataCell(role, 2340, { bold: true }),
                  dataCell(name, 2340),
                  dataCell(date, 2340),
                  dataCell(sig, 2340, { color: "999999", italics: true }),
                ],
              })
            ),
          ],
        }),

        spacer(400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "\u2014 END OF DOCUMENT \u2014", font: "Arial", size: 20, color: "999999" })],
        }),

      ],
    },
  ],
});

// ─── GENERATE ───
const OUTPUT = "/Users/dbucknor/Downloads/360_Quotes_Engine/ASI360_Project_Portal_PRD_v1.0.docx";

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`\u2705 PRD generated: ${OUTPUT}`);
  console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB`);
});
