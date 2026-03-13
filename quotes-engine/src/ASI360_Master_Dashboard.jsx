// ASI360 Master Build Dashboard
import { useState } from "react";

const COLORS = {
  navy: "#060D1A",
  blue: "#0F6FFF",
  cyan: "#00D4FF",
  green: "#00FF88",
  orange: "#FF6B00",
  red: "#FF2D55",
  gold: "#FFD700",
  white: "#F0F4FF",
  dim: "#8899BB",
  card: "#0A1628",
  border: "#1A2E4A",
};

const catalogData = [
  { cat: "Solar Trailer", sub: "LumiGuardian", count: 4, avgMsrp: 21699, totalVal: 86800, margin: 52, color: COLORS.gold },
  { cat: "Network Recorders", sub: "NVR", count: 35, avgMsrp: 2046, totalVal: 71598, margin: 52, color: COLORS.blue },
  { cat: "LumiCloud VSaaS", sub: "Recurring", count: 25, avgMsrp: 1161, totalVal: 29035, margin: 16.7, color: COLORS.cyan },
  { cat: "LumiCenter VMS", sub: "Software", count: 10, avgMsrp: 1740, totalVal: 17402, margin: 52, color: "#9B59B6" },
  { cat: "Complete Kits", sub: "Bundles", count: 8, avgMsrp: 2071, totalVal: 16572, margin: 52, color: COLORS.green },
  { cat: "PTZ Cameras", sub: "Network PTZ", count: 7, avgMsrp: 2170, totalVal: 15190, margin: 52, color: "#E74C3C" },
  { cat: "Specialty Cameras", sub: "Multi-sensor", count: 6, avgMsrp: 2157, totalVal: 12940, margin: 52, color: "#F39C12" },
  { cat: "N5-L LumiLux", sub: "High-End IP", count: 16, avgMsrp: 531, totalVal: 8490, margin: 52, color: "#1ABC9C" },
  { cat: "HDD Storage", sub: "Data Storage", count: 10, avgMsrp: 740, totalVal: 7396, margin: 52, color: "#95A5A6" },
  { cat: "Accessories", sub: "82 SKUs", count: 82, avgMsrp: 60, totalVal: 4881, margin: 10.1, color: COLORS.dim },
];

const pages = [
  { id: "home", title: "Homepage", url: "asi360.co/", phase: 1, day: 1, priority: "P1", sections: ["Hero + dual CTA", "Stats trust bar", "Services 4-cards", "Featured products", "Why ASI 360", "Case study teaser", "Quote CTA", "Blog preview"], template: "Security Services 02", icon: "🏠" },
  { id: "shop", title: "Shop", url: "shop.asi360.co/", phase: 1, day: 2, priority: "P1", sections: ["Shop hero", "Category nav (8)", "Product grid (268 SKUs)", "Luminys badge bar", "Custom product pages", "Bundle builder", "Stripe checkout"], template: "Generic eCommerce", icon: "🛒" },
  { id: "quote", title: "Get a Quote", url: "asi360.co/quote", phase: 1, day: 2, priority: "P1", sections: ["Hero: 2hr response", "3-step trust icons", "Multi-step form", "Webhook → Gateway", "What happens next", "FAQ accordion"], template: "Business Consultancy 04", icon: "📋" },
  { id: "services", title: "Services", url: "asi360.co/services", phase: 1, day: 3, priority: "P1", sections: ["System Design $500–$2K", "Installation $150/hr", "LumiCloud VSaaS", "POS/PBX Integration", "Pricing tiers", "LatePoint booking CTA"], template: "Professional Consultant 04", icon: "⚙️" },
  { id: "book", title: "Book Consultation", url: "asi360.co/book", phase: 2, day: 5, priority: "P1", sections: ["Hero: 30-min free call", "Service type selector", "LatePoint calendar", "What to expect", "Testimonial"], template: "Consultant 04", icon: "📅" },
  { id: "projects", title: "Portfolio", url: "asi360.co/projects", phase: 2, day: 6, priority: "P2", sections: ["Stats hero", "Filter bar", "Project cards (ACF CPT)", "Mad Oak case study", "Testimonial carousel", "Start project CTA"], template: "Agency 02", icon: "🏗️" },
  { id: "about", title: "About", url: "asi360.co/about", phase: 2, day: 7, priority: "P2", sections: ["Don Bucknor hero", "Luminys MVP badge", "20yr story", "Service area map", "Manufacturer logos", "Contact form"], template: "Sierra Industry 02", icon: "👤" },
  { id: "blog", title: "Blog / Resources", url: "asi360.co/blog", phase: 2, day: 8, priority: "P2", sections: ["Hero", "Category filter", "Featured post", "Post grid 6/page", "Sidebar shop + CTA", "Single post template"], template: "Business Blog 04", icon: "📝" },
  { id: "portal", title: "Client Portal", url: "asi360.co/portal", phase: 3, day: 20, priority: "P3", sections: ["WC My Account login", "React dashboard", "Order history + invoices", "Project status tracker", "Service request form"], template: "React App", icon: "🔐" },
  { id: "restaurant", title: "Restaurant Landing", url: "asi360.co/restaurant-security", phase: 2, day: 10, priority: "P2", sections: ["Pain-point hero", "Problem→solution pairs", "Recommended system", "Case study", "Pre-filled quote form"], template: "SEO Landing", icon: "🍴" },
  { id: "commercial", title: "Commercial Landing", url: "asi360.co/commercial-security", phase: 2, day: 11, priority: "P2", sections: ["Enterprise hero", "NDAA compliance angle", "AI analytics features", "Scale pricing tiers", "RFP quote form"], template: "SEO Landing", icon: "🏢" },
  { id: "categories", title: "Product Categories", url: "shop.asi360.co/cameras", phase: 1, day: 3, priority: "P1", sections: ["Category hero", "Buyer's guide snippet", "Filter sidebar", "Product grid lazy load", "CTA to /quote"], template: "WooCommerce Archive", icon: "📦" },
];

const techStack = [
  { layer: "CMS", items: ["WordPress 6.x", "Astra Pro", "Spectra (UAGB)", "WooCommerce 9.x", "ACF Pro"], color: COLORS.blue },
  { layer: "Forms + Booking", items: ["Gravity Forms", "GF Webhooks → :8443", "LatePoint", "LatePoint + Stripe"], color: COLORS.cyan },
  { layer: "Payments", items: ["Stripe WC Gateway", "Stripe Invoicing (N8N)", "WC PDF Invoices", "WC B2B Net Terms"], color: COLORS.green },
  { layer: "Data Backend", items: ["Supabase asi360-commerce", "ASI360 Gateway :8443", "N8N Cloud workflows", "vTiger CRM"], color: COLORS.gold },
  { layer: "Communications", items: ["Telnyx SMS → Don", "ElevenLabs 48hr IVR", "BoldSign e-signature", "WC Email receipts"], color: "#9B59B6" },
  { layer: "SEO + Perf", items: ["Yoast SEO", "Rank Math (products)", "WP Rocket / SG Optimizer", "Smush/Imagify"], color: COLORS.orange },
];

const revenue = [
  { stream: "Hardware Shop", url: "shop.asi360.co", margin: "51–56%", y1: 250000, y2: 1000000 },
  { stream: "System Design", url: "asi360.co/quote", margin: "~95%", y1: 120000, y2: 400000 },
  { stream: "Installation", url: "asi360.co/book", margin: "$150/hr", y1: 200000, y2: 800000 },
  { stream: "LumiCloud VSaaS", url: "recurring", margin: "$75–$500/mo", y1: 60000, y2: 240000 },
  { stream: "POS/PBX Legacy", url: "asi360.co/services", margin: "$1K–$8K/job", y1: 80000, y2: 200000 },
  { stream: "Referral/Reseller", url: "partner program", margin: "10–15%", y1: 40000, y2: 160000 },
];

const claudePrompts = [
  {
    num: 1, day: "Day 1", title: "WordPress Foundation + WooCommerce Setup",
    target: "asi360.co — SiteGround via SFTP/WP-CLI",
    tasks: ["Configure WooCommerce on shop.asi360.co (USD, guest checkout, Stripe)", "Create 8 WC product categories from Luminys taxonomy", "Import 3 ADI Quote #14395033 products at MAP pricing", "Astra Pro: navy #060D1A, blue #0F6FFF, font Barlow Condensed", "Output: WC product IDs for N3T-4LA2, R54-32PA, R54-32NA"],
    color: COLORS.blue
  },
  {
    num: 2, day: "Day 2", title: "Quote Pipeline: FastAPI + N8N Workflow",
    target: "Workspace droplet 159.223.118.208 — Gateway :8443",
    tasks: ["Create Supabase tables: asi360_clients + asi360_quotes", "Add /api/v1/quote/intake route to Gateway", "Pydantic validation + Vault key loading + log_call wrapper", "N8N: Webhook → Supabase → Claude draft → Telegram → BoldSign → status update", "Output: Route live, N8N webhook URLs, first test quote"],
    color: COLORS.cyan
  },
  {
    num: 3, day: "Day 3", title: "Luminys Catalog ETL → WooCommerce",
    target: "268 products from luminys_products → shop.asi360.co via WC REST API",
    tasks: ["Parse Supabase pricebook → staged JSON (MSRP, MAP, ADI cost = MSRP × 0.48)", "Map SKU prefixes → 8 WC categories (N→cameras, R→NVR, K→kits, etc.)", "Batch import 50/call via WC REST API, handle rate limits", "Sync each created product → asi360_products in Supabase", "Generate SD prompts for 20 hero SKU product images"],
    color: COLORS.green
  },
  {
    num: 4, day: "Day 4", title: "Spectra Page Builds via WordPress API",
    target: "asi360.co — WordPress REST API, UAGB blocks only",
    tasks: ["Homepage: full-width hero + dual CTA + stats + services + WC products + quote form", "Services page: wp:uagb/tabs for 4 service types + LatePoint embed", "Quote page: trust icons + multi-step Gravity Form + Supabase webhook", "All pages: full-width template, Navy #060D1A theme, set as front page"],
    color: COLORS.gold
  },
];

const blocker = {
  title: "One Blocker Before Day 1",
  steps: [
    { n: "01", text: "Point asi360.co DNS → SiteGround nameservers" },
    { n: "02", text: "Install WordPress + WooCommerce on SiteGround" },
    { n: "03", text: "Generate WC API keys (WooCommerce → Settings → Advanced → REST API)" },
    { n: "04", text: "Add to Supabase Vault as wc_asi360_consumer_key + wc_asi360_consumer_secret" },
  ],
  note: "Designer Agent code is live and waiting at :8205. Keys are the only missing piece."
};

export default function ASI360Dashboard() {
  const [activeTab, setActiveTab] = useState("strategy");
  const [activePrompt, setActivePrompt] = useState(0);
  const [activePage, setActivePage] = useState(null);

  const tabs = [
    { id: "strategy", label: "⚔️ Theme Strategy" },
    { id: "catalog", label: "📊 Catalog Intel" },
    { id: "pages", label: "🗺️ 12 Pages" },
    { id: "stack", label: "⚡ Tech Stack" },
    { id: "prompts", label: "🤖 Claude Code" },
    { id: "revenue", label: "💰 Revenue" },
  ];

  const totalY1 = revenue.reduce((s, r) => s + r.y1, 0);
  const totalY2 = revenue.reduce((s, r) => s + r.y2, 0);

  return (
    <div style={{ background: COLORS.navy, minHeight: "100vh", fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", color: COLORS.white }}>
      {/* HEADER */}
      <div style={{ background: `linear-gradient(135deg, #060D1A 0%, #0A1628 50%, #060D1A 100%)`, borderBottom: `1px solid ${COLORS.border}`, padding: "24px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1400, margin: "0 auto" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ width: 8, height: 32, background: `linear-gradient(180deg, ${COLORS.blue}, ${COLORS.cyan})`, borderRadius: 2 }} />
              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 3, color: COLORS.white, textTransform: "uppercase" }}>ASI 360</span>
              <span style={{ fontSize: 13, color: COLORS.cyan, letterSpacing: 4, textTransform: "uppercase", marginLeft: 8 }}>ALLIED SYSTEMS INTEGRATIONS</span>
            </div>
            <div style={{ fontSize: 13, color: COLORS.dim, letterSpacing: 2, marginLeft: 20 }}>MASTER BUILD DASHBOARD — ASTRA PRO + SPECTRA EDITION</div>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: "Products", val: "268" },
              { label: "Catalog Value", val: "$295K" },
              { label: "Gross Margin", val: "52%" },
              { label: "Year 1 Target", val: "$750K" },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.cyan }}>{stat.val}</div>
                <div style={{ fontSize: 11, color: COLORS.dim, textTransform: "uppercase", letterSpacing: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BLOCKER BANNER */}
      <div style={{ background: "linear-gradient(90deg, #1A0A00, #2A1500)", borderBottom: `1px solid ${COLORS.orange}33`, padding: "10px 32px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: COLORS.orange, fontSize: 18 }}>⚡</span>
          <span style={{ color: COLORS.orange, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>ACTION REQUIRED:</span>
          <span style={{ color: "#FFB366", fontSize: 13 }}>Point asi360.co DNS → SiteGround → Install WP+WC → Generate WC API Keys → Add to Supabase Vault</span>
          <span style={{ color: COLORS.dim, fontSize: 12, marginLeft: "auto" }}>Designer Agent live at :8205 · 5 new MCP tools ready · Code compiled ✓</span>
        </div>
      </div>

      {/* TABS */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "0 32px", background: "#080F1E" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", gap: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? COLORS.card : "transparent",
                border: "none", borderBottom: activeTab === tab.id ? `2px solid ${COLORS.blue}` : "2px solid transparent",
                color: activeTab === tab.id ? COLORS.white : COLORS.dim,
                padding: "14px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s",
                fontFamily: "inherit"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px" }}>

        {/* ───── STRATEGY TAB ───── */}
        {activeTab === "strategy" && (
          <div>
            <h2 style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: COLORS.cyan, marginBottom: 8 }}>Theme Strategy Decision</h2>
            <p style={{ color: COLORS.dim, marginBottom: 32, fontSize: 15 }}>Head-to-head analysis: Flatsome vs. Astra Pro + Spectra for asi360.co</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
              {/* FLATSOME — SKIP */}
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.red}44`, borderRadius: 12, padding: 28, position: "relative", opacity: 0.7 }}>
                <div style={{ position: "absolute", top: 16, right: 16, background: COLORS.red, color: "#fff", padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>SKIP</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#FF8888" }}>Flatsome</div>
                <div style={{ color: COLORS.dim, fontSize: 13, marginBottom: 20 }}>ThemeForest #5484319 — $59 one-time</div>
                {[
                  "$59 additional cost (you already have Astra Pro)",
                  "Proprietary UX Builder — shortcode lock-in",
                  "NOT compatible with designer-mcp tools",
                  "Less flexible for consulting + service pages",
                  "Two themes = two learning curves for VAs",
                  "Heavier page weight, slower Core Web Vitals",
                  "Cloudflare blocks scraping — opaque feature set",
                  "Requires full rebuild if theme abandoned",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                    <span style={{ color: COLORS.red, fontSize: 16, marginTop: 1 }}>✗</span>
                    <span style={{ fontSize: 14, color: "#CC8888" }}>{item}</span>
                  </div>
                ))}
              </div>

              {/* ASTRA PRO — WINNER */}
              <div style={{ background: COLORS.card, border: `2px solid ${COLORS.blue}`, borderRadius: 12, padding: 28, position: "relative" }}>
                <div style={{ position: "absolute", top: 16, right: 16, background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.cyan})`, color: "#fff", padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>✓ CONFIRMED</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: COLORS.cyan }}>Astra Pro + Spectra</div>
                <div style={{ color: COLORS.dim, fontSize: 13, marginBottom: 20 }}>Already licensed — $0 additional cost · Gutenberg-native</div>
                {[
                  "Full license already owned — zero additional spend",
                  "Gutenberg-native: Spectra (UAGB) blocks = WordPress standard",
                  "designer-mcp fully compatible — build pages via API",
                  "Security Services 02/04 templates available now",
                  "Business Consultancy Firm 04 — perfect for consulting + shop hybrid",
                  "Astra Header/Footer Builder + Mega Menu for product nav",
                  "LatePoint booking calendar deep integration",
                  "SiteGround-optimized: zero config performance boost",
                  "WooCommerce 9.x deep integration built-in",
                  "ACF Pro + Gravity Forms native block support",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                    <span style={{ color: COLORS.green, fontSize: 16, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 14, color: COLORS.white }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RECOMMENDED TEMPLATES */}
            <h3 style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: COLORS.blue, marginBottom: 16 }}>Recommended Astra Starter Templates for ASI 360</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
              {[
                { name: "Security Services 04", badge: "PRIMARY", url: "websitedemos.net/security-services-04", note: "Dark professional design — trust + corporate credibility", color: COLORS.blue },
                { name: "Security Services 02", badge: "BACKUP", url: "websitedemos.net/security-services-02", note: "Lead-gen focused, light theme, strong trust signals", color: COLORS.cyan },
                { name: "Business Consultancy 04", badge: "CONSULTING", url: "websitedemos.net/business-consultancy-firm-04", note: "Premium consulting + services hybrid", color: COLORS.green },
                { name: "Professional Consultant 04", badge: "SERVICES", url: "websitedemos.net/professional-consultant-04", note: "Polished fast site for /services + /book pages", color: COLORS.gold },
              ].map(t => (
                <div key={t.name} style={{ background: COLORS.card, border: `1px solid ${t.color}44`, borderRadius: 10, padding: 20 }}>
                  <div style={{ background: t.color, color: "#000", padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 2, display: "inline-block", marginBottom: 12 }}>{t.badge}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.white, marginBottom: 8 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.dim, marginBottom: 8 }}>{t.note}</div>
                  <div style={{ fontSize: 11, color: t.color, fontFamily: "monospace" }}>{t.url}</div>
                </div>
              ))}
            </div>

            {/* BLOCKER STEPS */}
            <div style={{ background: "#0A0800", border: `1px solid ${COLORS.orange}66`, borderRadius: 12, padding: 28 }}>
              <h3 style={{ fontSize: 16, letterSpacing: 2, textTransform: "uppercase", color: COLORS.orange, marginBottom: 20 }}>⚡ Execution Pre-Flight (Before Day 1)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {blocker.steps.map(s => (
                  <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${COLORS.orange}22`, border: `1px solid ${COLORS.orange}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: COLORS.orange, flexShrink: 0 }}>{s.n}</div>
                    <div style={{ fontSize: 13, color: "#FFB366", lineHeight: 1.5 }}>{s.text}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: COLORS.dim, fontStyle: "italic" }}>Note: {blocker.note}</div>
            </div>
          </div>
        )}

        {/* ───── CATALOG TAB ───── */}
        {activeTab === "catalog" && (
          <div>
            <h2 style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: COLORS.cyan, marginBottom: 8 }}>Live Catalog Intelligence</h2>
            <p style={{ color: COLORS.dim, marginBottom: 32, fontSize: 15 }}>268 products · 26 categories · $295,358 MSRP catalog value · 52% gross margin at MSRP · 48% ADI cost basis</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total SKUs", val: "268", sub: "Active products", color: COLORS.blue },
                { label: "Catalog Value", val: "$295K", sub: "At MSRP", color: COLORS.cyan },
                { label: "Gross Margin", val: "52%", sub: "At MSRP pricing", color: COLORS.green },
                { label: "Avg Unit Price", val: "$1,119", sub: "Average MSRP", color: COLORS.gold },
              ].map(s => (
                <div key={s.label} style={{ background: COLORS.card, border: `1px solid ${s.color}44`, borderRadius: 10, padding: 20 }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 13, color: COLORS.white, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.dim }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* CATEGORY BREAKDOWN */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 12, fontSize: 11, color: COLORS.dim, textTransform: "uppercase", letterSpacing: 2 }}>
                <span>Category</span><span>SKUs</span><span>Avg MSRP</span><span>Catalog Value</span><span>Margin</span><span>WC Category</span>
              </div>
              {catalogData.map((row, i) => {
                const pct = (row.totalVal / 295358) * 100;
                return (
                  <div key={i} style={{ padding: "14px 24px", borderBottom: `1px solid ${COLORS.border}22`, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: COLORS.white, fontWeight: 600 }}>{row.cat}</span>
                      </div>
                      <div style={{ marginTop: 4, height: 3, background: COLORS.border, borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: row.color, borderRadius: 2, maxWidth: "100%" }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: COLORS.dim }}>{row.count}</span>
                    <span style={{ fontSize: 14, color: COLORS.white }}>${row.avgMsrp.toLocaleString()}</span>
                    <span style={{ fontSize: 14, color: row.color, fontWeight: 700 }}>${(row.totalVal).toLocaleString()}</span>
                    <div>
                      <span style={{ fontSize: 14, color: row.margin >= 50 ? COLORS.green : COLORS.orange }}>{row.margin}%</span>
                    </div>
                    <span style={{ fontSize: 11, color: COLORS.dim, fontStyle: "italic" }}>{row.sub}</span>
                  </div>
                );
              })}
            </div>

            {/* ADI QUOTE HERO PRODUCTS */}
            <h3 style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: COLORS.blue, marginBottom: 16 }}>ADI Quote #14395033 — Day 1 Launch Products</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { sku: "N3T-4LA2", name: "4MP LumiLux Turret Camera", adi: 110.64, map: 226.78, msrp: 249.99, margin: 55.7, type: "IP Camera", icon: "📷" },
                { sku: "R54-32PA", name: "32Ch PoE NVR (32MP)", adi: 705.62, map: 1439.98, msrp: 1599.99, margin: 55.9, type: "Network Recorder", icon: "🖥️" },
                { sku: "R54-32NA", name: "32Ch NIC NVR (32MP)", adi: 606.89, map: 1241.98, msrp: 1379.99, margin: 56.0, type: "Network Recorder", icon: "🖥️" },
              ].map(p => (
                <div key={p.sku} style={{ background: COLORS.card, border: `1px solid ${COLORS.blue}44`, borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{p.icon}</div>
                  <div style={{ fontSize: 11, color: COLORS.cyan, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{p.sku} · {p.type}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.white, marginBottom: 16 }}>{p.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div style={{ background: "#FF2D5511", border: "1px solid #FF2D5544", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#FF8888" }}>${p.adi}</div>
                      <div style={{ fontSize: 10, color: COLORS.dim }}>ADI COST</div>
                    </div>
                    <div style={{ background: "#00D4FF11", border: "1px solid #00D4FF44", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.cyan }}>${p.map}</div>
                      <div style={{ fontSize: 10, color: COLORS.dim }}>MAP FLOOR</div>
                    </div>
                    <div style={{ background: "#00FF8811", border: "1px solid #00FF8844", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.green }}>{p.margin}%</div>
                      <div style={{ fontSize: 10, color: COLORS.dim }}>AT MSRP</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#00100500", border: `1px solid ${COLORS.green}44`, borderRadius: 10, padding: 16, fontSize: 13, color: "#88EE88" }}>
              <strong style={{ color: COLORS.green }}>Luminys Ambassador Pricing:</strong> 52% off MSRP = your ADI cost. Never advertise below MAP. List at MSRP, show MAP as "Your Price." ADI Quote expires 04/04/2026.
            </div>
          </div>
        )}

        {/* ───── PAGES TAB ───── */}
        {activeTab === "pages" && (
          <div>
            <h2 style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: COLORS.cyan, marginBottom: 8 }}>12-Page Site Architecture</h2>
            <p style={{ color: COLORS.dim, marginBottom: 32, fontSize: 15 }}>Click any page for full section breakdown · All built with Spectra (UAGB) + Astra Pro</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {pages.map(page => (
                <div
                  key={page.id}
                  onClick={() => setActivePage(activePage === page.id ? null : page.id)}
                  style={{
                    background: COLORS.card, border: `1px solid ${activePage === page.id ? COLORS.blue : COLORS.border}`,
                    borderRadius: 12, padding: 20, cursor: "pointer", transition: "all 0.2s",
                    borderLeft: `4px solid ${page.phase === 1 ? COLORS.blue : page.phase === 2 ? COLORS.cyan : COLORS.dim}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 24, marginRight: 8 }}>{page.icon}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.white }}>{page.title}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, background: page.priority === "P1" ? `${COLORS.blue}33` : `${COLORS.cyan}22`, color: page.priority === "P1" ? COLORS.blue : COLORS.cyan, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{page.priority}</span>
                      <span style={{ fontSize: 10, background: "#FFFFFF11", color: COLORS.dim, padding: "2px 8px", borderRadius: 4 }}>Ph{page.phase}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.cyan, fontFamily: "monospace", marginBottom: 8 }}>{page.url}</div>
                  <div style={{ fontSize: 11, color: COLORS.dim }}>Template: {page.template} · Day {page.day}</div>

                  {activePage === page.id && (
                    <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                      <div style={{ fontSize: 11, color: COLORS.blue, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Sections</div>
                      {page.sections.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ color: COLORS.blue, fontSize: 12, marginTop: 2 }}>›</span>
                          <span style={{ fontSize: 13, color: COLORS.white }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* PHASE LEGEND */}
            <div style={{ marginTop: 24, display: "flex", gap: 24 }}>
              {[
                { phase: "Phase 1 — Foundation", color: COLORS.blue, desc: "Week 1: WordPress + WC + 3 products + Quote form live" },
                { phase: "Phase 2 — Content", color: COLORS.cyan, desc: "Week 2–3: Catalog ETL + AI proposals + SEO pages" },
                { phase: "Phase 3 — Portal", color: COLORS.dim, desc: "Month 2: React portal + VA onboarding + Google Ads" },
              ].map(p => (
                <div key={p.phase} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: p.color }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.phase}</div>
                    <div style={{ fontSize: 11, color: COLORS.dim }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ───── TECH STACK TAB ───── */}
        {activeTab === "stack" && (
          <div>
            <h2 style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: COLORS.cyan, marginBottom: 8 }}>Definitive Tech Stack</h2>
            <p style={{ color: COLORS.dim, marginBottom: 32, fontSize: 15 }}>asi360.co · shop.asi360.co · api.asi360.co · portal.asi360.co</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
              {techStack.map(layer => (
                <div key={layer.layer} style={{ background: COLORS.card, border: `1px solid ${layer.color}33`, borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 12, color: layer.color, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 2, background: layer.color }} />
                    {layer.layer}
                  </div>
                  {layer.items.map((item, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: i < layer.items.length - 1 ? `1px solid ${COLORS.border}` : "none", fontSize: 14, color: COLORS.white }}>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* ARCHITECTURE FLOW */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 28 }}>
              <h3 style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: COLORS.blue, marginBottom: 20 }}>Quote Pipeline Architecture (0 → Signed in &lt;5 min)</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
                {[
                  { label: "Customer\n/quote form", color: COLORS.blue },
                  { label: "Gravity Forms\nWebhook POST", color: COLORS.cyan },
                  { label: "Gateway :8443\n/quote/intake", color: COLORS.green },
                  { label: "Supabase\nasi360_quotes", color: COLORS.gold },
                  { label: "SMS → Don\nTelnyx/Twilio", color: "#9B59B6" },
                  { label: "N8N\nAI draft", color: COLORS.orange },
                  { label: "Telegram\nApprove/Reject", color: COLORS.cyan },
                  { label: "BoldSign\ne-Signature", color: COLORS.green },
                ].map((step, i, arr) => (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ background: `${step.color}22`, border: `1px solid ${step.color}66`, borderRadius: 8, padding: "10px 16px", textAlign: "center", minWidth: 90 }}>
                      <div style={{ fontSize: 11, color: step.color, fontWeight: 700, whiteSpace: "pre-line", lineHeight: 1.4 }}>{step.label}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ color: COLORS.dim, fontSize: 18, margin: "0 4px" }}>→</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ───── CLAUDE CODE TAB ───── */}
        {activeTab === "prompts" && (
          <div>
            <h2 style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: COLORS.cyan, marginBottom: 8 }}>Claude Code Execution Prompts</h2>
            <p style={{ color: COLORS.dim, marginBottom: 32, fontSize: 15 }}>4 ready-to-run prompts · Execute in order · Revenue theoretically possible by Day 3</p>

            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              {claudePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActivePrompt(i)}
                  style={{
                    background: activePrompt === i ? p.color : COLORS.card,
                    border: `1px solid ${p.color}`,
                    color: activePrompt === i ? "#000" : p.color,
                    padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                    fontSize: 13, fontWeight: 700, letterSpacing: 1, fontFamily: "inherit"
                  }}
                >
                  PROMPT {p.num} — {p.day}
                </button>
              ))}
            </div>

            {claudePrompts.map((prompt, i) => i === activePrompt && (
              <div key={i} style={{ background: COLORS.card, border: `2px solid ${prompt.color}44`, borderRadius: 16, padding: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 13, color: prompt.color, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>PROMPT {prompt.num} · {prompt.day}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.white }}>{prompt.title}</div>
                  </div>
                  <div style={{ background: `${prompt.color}22`, border: `1px solid ${prompt.color}66`, borderRadius: 8, padding: "8px 16px", fontSize: 12, color: prompt.color, fontFamily: "monospace" }}>
                    Target: {prompt.target}
                  </div>
                </div>

                <div style={{ fontSize: 13, color: COLORS.dim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Task Checklist</div>
                {prompt.tasks.map((task, j) => (
                  <div key={j} style={{ display: "flex", gap: 16, padding: "14px 0", borderBottom: `1px solid ${COLORS.border}`, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, border: `2px solid ${prompt.color}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: prompt.color, fontWeight: 700, flexShrink: 0 }}>{j + 1}</div>
                    <div style={{ fontSize: 15, color: COLORS.white, lineHeight: 1.6 }}>{task}</div>
                  </div>
                ))}

                <div style={{ marginTop: 24, background: "#FFFFFF08", borderRadius: 10, padding: 20 }}>
                  <div style={{ fontSize: 12, color: COLORS.dim, marginBottom: 8 }}>Run in Claude Code on Mac Mini:</div>
                  <code style={{ fontSize: 13, color: prompt.color, fontFamily: "monospace" }}>
                    claude "Execute ASI 360 Website Build — Prompt {prompt.num}: {prompt.title}. Target: {prompt.target}. Follow the complete task list from ASI360_Site_Blueprint.html §05 Prompt {prompt.num}."
                  </code>
                </div>
              </div>
            ))}

            {/* MCP TOOLS STATUS */}
            <div style={{ marginTop: 24, background: COLORS.card, border: `1px solid ${COLORS.green}44`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: COLORS.green, marginBottom: 16 }}>Designer Agent MCP Tools — Live ✓</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                {[
                  { tool: "wc_create_product", desc: "SKU → live WC product" },
                  { tool: "wc_bulk_import", desc: "List of SKUs → async batch" },
                  { tool: "wc_list_products", desc: "Check shop.asi360.co inventory" },
                  { tool: "margin_check", desc: "Instant margin from pricebook" },
                  { tool: "build_asi360_page", desc: "Build home/quote/consulting/shop" },
                ].map(t => (
                  <div key={t.tool} style={{ background: "#00100A", border: `1px solid ${COLORS.green}33`, borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: COLORS.green, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>{t.tool}</div>
                    <div style={{ fontSize: 12, color: COLORS.dim }}>{t.desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: COLORS.dim }}>All 5 tools compiled and deployed to :8205. Restart Claude Code to load them.</div>
            </div>
          </div>
        )}

        {/* ───── REVENUE TAB ───── */}
        {activeTab === "revenue" && (
          <div>
            <h2 style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: COLORS.cyan, marginBottom: 8 }}>Revenue Architecture</h2>
            <p style={{ color: COLORS.dim, marginBottom: 32, fontSize: 15 }}>6 revenue streams · $750K Year 1 target · $2.8M Year 2 ceiling</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
              <div style={{ background: COLORS.card, border: `2px solid ${COLORS.blue}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.dim, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Year 1 Revenue Target</div>
                <div style={{ fontSize: 52, fontWeight: 700, color: COLORS.blue }}>${(totalY1 / 1000).toFixed(0)}K</div>
                <div style={{ fontSize: 14, color: COLORS.dim }}>Combined all 6 streams</div>
              </div>
              <div style={{ background: COLORS.card, border: `2px solid ${COLORS.cyan}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.dim, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Year 2 Revenue Target</div>
                <div style={{ fontSize: 52, fontWeight: 700, color: COLORS.cyan }}>${(totalY2 / 1000000).toFixed(1)}M</div>
                <div style={{ fontSize: 14, color: COLORS.dim }}>With VA team + Google Ads</div>
              </div>
            </div>

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 12, fontSize: 11, color: COLORS.dim, textTransform: "uppercase", letterSpacing: 2 }}>
                <span>Revenue Stream</span><span>Model</span><span>Year 1</span><span>Year 2</span>
              </div>
              {revenue.map((r, i) => {
                const y2pct = (r.y2 / totalY2) * 100;
                const colors = [COLORS.blue, COLORS.cyan, COLORS.green, COLORS.gold, "#9B59B6", COLORS.orange];
                const col = colors[i];
                return (
                  <div key={i} style={{ padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}22`, display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.white, marginBottom: 4 }}>{r.stream}</div>
                      <div style={{ fontSize: 11, color: COLORS.dim, fontFamily: "monospace" }}>{r.url}</div>
                      <div style={{ marginTop: 6, height: 3, background: COLORS.border, borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${y2pct}%`, background: col, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: col }}>{r.margin}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.white }}>${(r.y1 / 1000).toFixed(0)}K</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: col }}>${(r.y2 / 1000000).toFixed(1)}M</div>
                  </div>
                );
              })}
              <div style={{ padding: "16px 24px", background: "#FFFFFF08", display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.white }}>TOTAL</div>
                <div />
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.blue }}>${(totalY1 / 1000).toFixed(0)}K</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.cyan }}>${(totalY2 / 1000000).toFixed(1)}M</div>
              </div>
            </div>

            {/* TIMELINE */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 28 }}>
              <h3 style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: COLORS.blue, marginBottom: 20 }}>4-Week Build Sprint</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {[
                  { week: "Week 1", title: "Foundation", color: COLORS.blue, items: ["WP + Astra Pro + Spectra", "3 ADI products at MAP", "Homepage via Spectra", "Quote form → Gateway → SMS", "Stripe checkout live"] },
                  { week: "Week 2", title: "Pipeline", color: COLORS.cyan, items: ["N8N AI proposals", "BoldSign e-signature", "268 Luminys products ETL", "Services + LatePoint live", "3 SEO blog posts"] },
                  { week: "Week 3", title: "Depth", color: COLORS.green, items: ["Mad Oak case study", "/restaurant-security page", "/commercial-security page", "WC product filters", "8 blog posts published"] },
                  { week: "Week 4", title: "Scale", color: COLORS.gold, items: ["React Quote Builder", "Client portal MVP", "VA onboarding SOPs", "Google Ads live (Reno NV)", "20 posts/mo schedule"] },
                ].map(w => (
                  <div key={w.week} style={{ background: "#FFFFFF05", border: `1px solid ${w.color}33`, borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 11, color: w.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{w.week}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.white, marginBottom: 16 }}>{w.title}</div>
                    {w.items.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                        <span style={{ color: w.color, fontSize: 12, marginTop: 2 }}>›</span>
                        <span style={{ fontSize: 13, color: COLORS.dim }}>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "16px 32px", textAlign: "center", fontSize: 11, color: COLORS.dim, letterSpacing: 2 }}>
        ASI 360 · ALLIED SYSTEMS INTEGRATIONS · Don Bucknor, CEO · Oakland, CA · Gateway :8443 ✓ · Designer Agent :8205 ✓ · Supabase asi360-commerce ✓
      </div>
    </div>
  );
}
