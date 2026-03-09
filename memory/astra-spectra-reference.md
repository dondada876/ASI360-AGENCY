# Astra Pro + Spectra Pro — Frontend Designer Reference

> **Purpose:** Rapid website production reference for building hundreds of WordPress sites using the Astra Pro + Spectra Pro stack. Covers every major feature, block, and configuration pattern needed for production.

---

## Table of Contents

1. [Quick-Start: New Site in 15 Minutes](#quick-start)
2. [Astra Pro Modules](#astra-pro-modules)
3. [Spectra Block Library](#spectra-block-library)
4. [Astra Customizer Settings](#customizer-settings)
5. [Page Building Patterns](#page-patterns)
6. [WooCommerce Integration](#woocommerce)
7. [REST API Patterns](#rest-api)
8. [Mass Production Playbook](#mass-production)
9. [Global Block Styles & Theming](#global-styles)
10. [Responsive Design](#responsive-design)
11. [Troubleshooting & Common Issues](#troubleshooting)

---

## 1. Quick-Start: New Site in 15 Minutes {#quick-start}

### Step 1 — Import Starter Template
Templates are the fastest path. Never build from scratch.

**Via WP Admin:**
1. Appearance → Starter Templates
2. Pick a template matching the client's industry
3. Click "Import Complete Site" → imports pages, customizer settings, widgets, plugins
4. Takes ~2-3 minutes

**Via WP-CLI (SSH):**
```bash
wp starter-templates list --path=/var/www/sitename
wp astra-sites import <template-id> --yes --path=/var/www/sitename
```

### Step 2 — Activate Licenses
```bash
# Astra Pro
wp brainstormforce license activate astra-addon 78556789547f911ad94942fc91e327d3

# Spectra Pro (if WP-CLI command available)
# Otherwise activate via wp-admin → Spectra → Settings → License
```

### Step 3 — Customize Brand (Customizer)
1. Appearance → Customize → Global → Colors
2. Set primary/secondary/accent colors to client brand
3. Global → Typography → Set heading + body fonts
4. Header Builder → Swap logo, adjust navigation
5. Footer Builder → Update copyright, links, contact info

### Step 4 — Edit Page Content
- Open each page in Gutenberg editor
- Modify text within existing Spectra blocks (preserve block structure!)
- Replace placeholder images via Media Library
- **NEVER do full content replacement via REST API** (destroys Spectra block styling — see BUG-002)

### Step 5 — Launch Checklist
- [ ] All pages reviewed and text updated
- [ ] Logo and favicon uploaded
- [ ] Contact forms tested (email delivery)
- [ ] Mobile responsive check (preview at 375px, 768px, 1280px)
- [ ] SEO: titles, meta descriptions set
- [ ] SSL certificate active
- [ ] Analytics/tracking code added
- [ ] Performance: page speed check

---

## 2. Astra Pro Modules {#astra-pro-modules}

### 2.1 Header Builder
**Location:** Appearance → Customize → Header

**Layout:** 3-row grid system:
- **Primary Header** — Main row for Logo, Primary Menu, Search, Cart, Account
- **Above Header** — Upper row for secondary menus, social icons, CTAs, HTML notifications
- **Below Header** — Lower row for supplementary content
- Each row has 3 zones: Left, Center, Right — drag elements between them

**Available Elements:**
| Element | Description |
|---------|-------------|
| Site Title & Logo | Retina support, width slider |
| Primary Menu | Submenu width, item divider, hover style, submenu animations |
| Secondary Menu | Additional navigation |
| Button | Custom CTA button |
| Search | With Live Search toggle (REST API powered) |
| Social Icons | Platform icons with alignment |
| HTML | Custom HTML, shortcodes |
| Widget | Any WordPress widget |
| Toggle Button | Mobile hamburger icon |
| Account (Pro) | WooCommerce/LearnDash login/profile |
| Cart (Pro) | WooCommerce mini-cart |
| Language Switcher (Pro) | Multi-language support |
| Divider (Pro) | Visual separator |

**Per-Row Settings:**
- Height, Bottom Border Size & Color
- Background (Color/Image)
- Padding, Margin
- Header width: Full Width vs Content Width

**Primary Menu Settings:**
- Submenu Width, Item Divider
- Stack on Mobile toggle
- Hover Style, Submenu Animations
- Text/Background Colors per state
- Font family, size, weight, spacing

**Transparent Header:**
- Enable per Desktop/Mobile independently
- Separate logo for transparent state
- Overlay color, bottom border
- Per-element color overrides (menu text, buttons, etc.)

**Mobile Header (Off-Canvas):**
- **Flyout** — Slides in from side
- **Full-Screen** — Covers entire viewport
- **Dropdown** — Drops down from header
- Dropdown Target: Icon vs Link
- Content Alignment settings

**Pro Extras:** Per-page header rules, custom mobile headers, Sticky Header integration

### 2.2 Footer Builder
**Location:** Appearance → Customize → Footer Builder

**Layout:** 3-row grid system (mirrors Header Builder):
- **Primary Footer** — Main footer row with widgets, menus, copyright
- **Above Footer** — Upper row for secondary content
- **Below Footer** — Bottom row for legal links, copyright

**Per-Row General Settings:**
- Column Count: 1, 2, 3, 4, 5, or 6
- Column Layout: Equal, 2:1, 1:2, 1:1:2, 2:1:1, etc.
- Inner Elements Layout: Inline or Stacked
- Width: Full Width or Content Width
- Height (px)
- Vertical Alignment: Top, Middle, Bottom

**Per-Row Design Settings:**
- Top Border: Size, Color
- Background: Color, Image, Gradient
- Inner Column Spacing
- Padding, Margin (responsive)

**Available Elements:**
| Element | Description |
|---------|-------------|
| Footer Menu | Dedicated navigation menu |
| Social Icons | Platform icons with style options |
| HTML 1/2 | Custom markup or shortcodes |
| Widget 1-4 | Any registered WordPress widget |
| Copyright | Dynamic text with shortcodes |
| Site Title & Logo | Brand identification |
| Button | CTA button |

**Copyright Shortcodes:**
- `[copyright]` — &copy; symbol
- `[current_year]` — Auto-updating year (e.g., 2026)
- `[site_title]` — From Settings → General
- `[theme_author]` — Links to Astra

**Example:** `Copyright [copyright] [current_year] [site_title]. All rights reserved.`

**Responsive:** Each row can be independently hidden on Desktop/Tablet/Mobile

### 2.3 Mega Menu (Pro)
**Location:** Appearance → Menus → select a menu item → expand → Mega Menu settings

**Enable:** Must first activate mega menu support per menu location.

**Programmatic Setup (required mu-plugin):**
```php
// wp-content/mu-plugins/asi360-mega-menu.php
add_filter('astra_nav_mega_menu_support', function($menus) {
    $menus[] = 'primary-menu';
    $menus[] = 'secondary-menu';
    return $menus;
});
```

**Per-Item Configuration:**
- **Enable Mega Menu** toggle on any top-level menu item
- **Width Options:**
  - Content Width — matches site container
  - Full Width — edge to edge of viewport
  - Custom Width — specific pixel value
- **Columns:** 1-6 columns for sub-menu layout
- **Column Headings:** Style sub-items as group headers
- **Disable Link:** Turn a menu item into a non-clickable heading

**Design Settings:**
- Background: Color or Image
- Spacing between items
- Column dividers

**Highlight Labels (Pro):**
Apply colored badges to menu items:
- **New** — Green badge
- **Sale** — Red badge
- **Featured** — Blue badge
- **Free** — Custom color badge
- Custom label text and background color

**Important:** Mega menu is a visual-only (Customizer/admin) feature. Cannot be fully configured via REST API — requires browser or mu-plugin deployment.

### 2.4 Custom Layouts / Site Builder (Pro)
**Location:** Astra → Custom Layouts (wp-admin sidebar)

**Purpose:** Inject custom HTML/Spectra blocks at any hook location on the site without editing theme files. The most powerful Astra Pro feature for mass production.

**Layout Types:**
| Type | Purpose |
|------|---------|
| **Header** | Replace the entire site header with custom design |
| **Footer** | Replace the entire site footer with custom design |
| **404 Page** | Custom 404 error page |
| **Hooks** | Insert content at specific Astra action hook points |

**Hook Positions (most used):**
| Hook | Position |
|------|----------|
| `astra_body_top` | First element after `<body>` — announcements, banners |
| `astra_header_before` | Before entire header — notification bars |
| `astra_header_after` | After entire header — breadcrumbs, sub-navigation |
| `astra_primary_content_top` | Top of page content area |
| `astra_primary_content_bottom` | Bottom of page content area |
| `astra_entry_top` | Top of post/page entry — author boxes, share bars |
| `astra_entry_bottom` | Bottom of post/page entry — CTA sections |
| `astra_content_before` | Before the main content wrapper |
| `astra_content_after` | After the main content wrapper |
| `astra_footer_before` | Before entire footer — CTA strips |
| `astra_body_bottom` | Last element before `</body>` — popups, modals |

Full hook reference: https://developers.wpastra.com/theme-visual-hooks/

**Display Rules (Targeting):**
- **Include:** Entire Website, Specific Pages/Posts, All Posts, All Pages, All Archives, Taxonomy Terms, WooCommerce Products/Shop
- **Exclude:** Override include rules for specific pages
- **User Role:** All Users, Logged In, Logged Out, specific roles (Admin, Editor, Customer, etc.)
- **Device:** Desktop, Mobile, or Both
- **Date/Time:** Schedule start and end dates for time-limited content (sale banners, events)

**Priority:** Numeric value (1-100) controls ordering when multiple layouts target the same hook.

**REST API:** Custom layouts use `astra-advanced-hook` post type:
```bash
# Create a global CTA banner
curl -X POST "https://site.com/wp-json/wp/v2/astra-advanced-hook" \
  -u "user:app-password" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  -d '{"title":"Global CTA Banner","status":"publish","content":"<!-- wp:uagb/call-to-action -->...<!-- /wp:uagb/call-to-action -->"}'
```

**Mass Production Tip:** Build a library of reusable Custom Layouts (announcement bars, CTA strips, exit-intent popups) and deploy them per-client using display rules.

### 2.5 Sticky Header (Pro)
**Location:** Appearance → Customize → Header Builder → Primary Header row → Design tab → Sticky Header section

**Enable:** Toggle on per header row (Primary, Above, Below can each be sticky independently).

**Settings:**
| Setting | Options |
|---------|---------|
| Enable Sticky | Per Desktop / Per Mobile independently |
| Shrink Effect | Header reduces height on scroll (logo shrinks, padding decreases) |
| Animation | Slide Down, Fade In, None |
| Hide on Scroll Down | Header hides when scrolling down, reappears on scroll up |
| Sticky Logo | Separate logo for sticky state (useful for dark/light variants) |
| Sticky Logo Width | Independent width from normal header logo |

**Sticky Style Overrides:**
- Background Color (e.g., white when sticky on transparent header)
- Menu Text Color, Menu Hover Color
- Button colors
- Bottom Border
- Box Shadow (adds depth when sticky)

**CSS Selector:** `.ast-sticky-active` — Use for custom CSS targeting sticky state.

**Best Practice:** Combine with Transparent Header for hero sections — transparent on initial load, solid white with dark text when sticky.

### 2.6 Page Headers / Banners (Pro)
**Location:** Appearance → Customize → Page Headers (also called "Banner" in some versions)

**Purpose:** Add visual banner sections below the site header on archive/single pages with title, breadcrumbs, and background imagery.

**Layout Options:**
- **Stacked** — Title and breadcrumbs stacked vertically
- **Inline** — Title and breadcrumbs on same line

**Background Settings:**
| Setting | Options |
|---------|---------|
| Background Type | Color, Image, Custom (Featured Image) |
| Background Image | Static or Post Featured Image |
| Parallax | Enable parallax scrolling effect on background |
| Overlay Color | Semi-transparent overlay with opacity slider (0-100) |
| Banner Height | Custom pixel value |

**Content Settings:**
- Show/Hide Title
- Show/Hide Breadcrumbs
- Show/Hide Excerpt
- Text Alignment: Left, Center, Right
- Custom Typography for title (family, size, weight, color)
- Merge with Site Header — overlaps banner and header for seamless look

**Per-Page Override:** Each page/post can override these settings in the Astra Settings metabox (sidebar in editor).

**Mass Production Tip:** Set a default page header with client brand color overlay, then use per-page featured images for visual variety without additional configuration.

### 2.7 Blog Pro (Pro)
**Location:** Appearance → Customize → Blog

**Archive/Blog Page Settings:**
| Setting | Options |
|---------|---------|
| Layout | List, Grid (2-4 columns), Masonry |
| Content Display | Excerpt / Full Content |
| Excerpt Length | Word count |
| Read More Label | Custom text (e.g., "Continue Reading →") |
| Pagination | Standard, Infinite Scroll, Load More button |
| Date Box | Enable styled date display on post cards |
| Post Structure | Drag to reorder: Image, Title, Meta, Excerpt |
| Meta Order | Author, Date, Category, Tag, Comments |

**Single Post Options:**
| Setting | Description |
|---------|-------------|
| Author Info Box | Author bio box below post content with avatar + description |
| Related Posts | Grid of related posts below content (by category or tag) |
| Related Posts Grid | 1-4 columns, post count |
| Auto-Load Previous Posts | Infinite scroll loads previous posts as user scrolls |
| Social Share | Facebook, Twitter, LinkedIn, Pinterest, Email buttons |
| Share Position | Above content, Below content, or Both |

**Post Meta Configuration:**
- Show/hide each meta element independently
- Date format customization
- Author link to archive or custom URL
- Category/tag separator character

**Filters for Programmatic Control:**
```php
// Change related posts count
add_filter('flavor_flavor_flavor', function() { return 4; });
// Use astra_related_posts_count filter
```

### 2.8 Site Layouts & Container
**Location:** Appearance → Customize → Global → Container

**Layout Options:**
| Layout | Description |
|--------|-------------|
| **Full Width / Contained** | Content stretches full width with contained inner content |
| **Boxed** | Entire site inside a centered box with background visible on sides |
| **Content Boxed** | Only content area is boxed, header/footer are full-width |
| **Narrow Width** | Reduced content width for reading-focused pages |

**Container Width:** Default 1200px, adjustable (800-2000px)

**Sidebar:**
- Global default: No Sidebar, Left, Right
- Per-page override in Astra Settings metabox
- Sidebar width percentage

**Per-Page Override (Astra Settings metabox in editor):**
- Content Layout override
- Sidebar Position override
- Disable Header / Footer / Title (useful for landing pages)
- Enable/Disable Transparent Header
- Page Header (Banner) override

### 2.9 Breadcrumbs
**Location:** Appearance → Customize → Breadcrumbs (also available as Header Builder element)

**Source Options:** Astra built-in, Yoast SEO, Rank Math SEO, Breadcrumb NavXT

**Position:**
- Inside Header (drag to Header Builder)
- After Header, Before Title
- After Title

**Design Settings:**
- Separator Character: ›, /, >, →, or custom
- Font Family, Size, Weight
- Text Color, Link Color, Link Hover Color
- Alignment: Left, Center, Right
- Spacing (responsive)

**SEO Benefit:** Breadcrumbs generate structured data (BreadcrumbList schema) when using Yoast/Rank Math source, improving search appearance.

### 2.10 Scroll to Top
**Location:** Appearance → Customize → Global → Scroll to Top

**Settings:**
| Setting | Options |
|---------|---------|
| Enable | Toggle on/off |
| Icon | Arrow up (default), chevron, or custom |
| Icon Size | px slider |
| Position | Bottom-Left or Bottom-Right |
| Offset | Pixels from bottom of viewport before button appears |
| Colors | Icon color, Background color, Hover states |
| Border Radius | Square to fully rounded |
| Mobile | Show/hide on mobile devices |

### 2.11 Live Search (Astra 4.4.0+)
**Location:** Appearance → Customize → Header Builder → Search element → Enable Live Search

**Features:**
- AJAX-powered instant results as user types
- Searches Posts, Pages, WooCommerce Products simultaneously
- Thumbnail previews in results dropdown
- REST API powered: `/wp-json/wp/v2/search/`

**Settings:**
| Setting | Options |
|---------|---------|
| Search Style | Search Box (visible) or Slide (expands on click) |
| Live Results | Enable/disable live AJAX search |
| Result Count | Max results to display in dropdown |
| Post Types | Select which post types to search |
| Thumbnail | Show/hide featured image in results |

**Styling:**
- Search icon color and size
- Input field: border, background, text color
- Dropdown: background, text color, hover state, shadow

### 2.12 Starter Templates / Site Builder
**Location:** Appearance → Starter Templates (after plugin activation)

**Purpose:** One-click full site imports with Gutenberg/Spectra-compatible designs. The fastest way to bootstrap any new client site.

**Template Categories:** Business, Agency, Restaurant, eCommerce, Blog, Portfolio, Education, Health & Fitness, Real Estate, Travel, Construction, Law, Technology, Non-Profit, Church, Photography, Automotive, Beauty/Salon, Consulting, Finance, Manufacturing, Medical, SaaS, Wedding

**What Gets Imported (Full Site):**
| Component | Description |
|-----------|-------------|
| Pages | Complete pages with Spectra block layouts (Home, About, Services, Contact, etc.) |
| Customizer Settings | Colors, typography, header/footer builder, global styles |
| Required Plugins | Auto-installs needed plugins (Spectra, WooCommerce, etc.) |
| Widgets | Sidebar and footer widgets |
| Forms | Contact form configurations |
| Blog Posts | Sample blog posts with featured images |
| WooCommerce | Products, shop page, cart/checkout (if applicable) |
| Menus | Navigation menus with proper page links |

**Partial Import:** Import individual pages from any template without full site import — useful for cherry-picking page designs.

**WP-CLI Import:**
```bash
# List available templates
wp starter-templates list --path=/var/www/sitename

# Import by template ID
wp astra-sites import <template-id> --yes --path=/var/www/sitename
```

**Mass Production Tip:** Pick 5-10 "base" templates that cover your most common client industries. Learn their block structure — then brand customization becomes a 10-minute process instead of building from scratch.

---

## 3. Spectra Block Library {#spectra-block-library}

All blocks use the `uagb/` namespace. Always wrap page sections in `uagb/container`.

### 3.1 Container (`uagb/container`) — CRITICAL BLOCK
**The foundational layout block.** Every page section MUST start with a container. This is the most important Spectra block — master it thoroughly.

**Layout Settings:**
| Setting | Options | Default |
|---------|---------|---------|
| Content Width | Full Width (`alignfull`), Wide Width (`alignwide`), Custom (px) | Full Width |
| Inner Content Width | Boxed (constrained) or Full Width (edge-to-edge) | Boxed |
| Direction | Row (horizontal) or Column (vertical) | Column |
| Align Items | Flex Start, Center, Flex End, Stretch | Stretch |
| Justify Content | Flex Start, Center, Flex End, Space Between, Space Around, Space Evenly | Flex Start |
| Wrap | Wrap, No Wrap | Wrap |
| Gap | px/em/% between child elements (Row Gap + Column Gap) | 10px |
| Min Height | Custom px/vh value | none |
| Overflow | Visible, Hidden | Visible |
| HTML Tag | `div`, `section`, `article`, `main`, `header`, `footer`, `aside`, `nav` | `div` |

**Background Settings:**
| Type | Properties |
|------|------------|
| Color | Solid color picker |
| Gradient | Linear/Radial gradient builder with angle, stops, colors |
| Image | URL, size (Cover/Contain/Custom), position, repeat, attachment (Fixed=parallax) |
| Video | Self-hosted video URL, fallback image |
| Overlay | Color/Gradient overlay on top of image/video, opacity (0-1) |

**Spacing (Responsive):**
- Padding: Top/Right/Bottom/Left — separate values for Desktop/Tablet/Mobile
- Margin: Top/Right/Bottom/Left — separate values for Desktop/Tablet/Mobile
- Units: px, em, %, vh, vw

**Border & Shadow:**
- Border: Style (solid/dashed/dotted), Width, Color, Radius (all 4 corners)
- Box Shadow: Horizontal, Vertical, Blur, Spread, Color, Inset
- Hover Border and Hover Shadow

**Advanced Features (Pro):**
- **Shape Dividers** — Top/Bottom SVG dividers (mountains, waves, clouds, triangles, etc.), color, height, flip, invert
- **Sticky Container** — Stick to top on scroll (like a secondary sticky header)
- **Block Presets** — Save/apply container style presets

**Nesting Pattern (most common):**
```html
<!-- Full-width background with centered content -->
<!-- wp:uagb/container {"contentWidth":"alignfull","innerContentWidth":"alignwide","backgroundType":"color","backgroundColor":"#1A3A5C","topPaddingDesktop":60,"bottomPaddingDesktop":60} -->
<div class="wp-block-uagb-container">
  <!-- wp:uagb/container {"direction":"row","wrap":"wrap","columnGap":30} -->
  <div class="wp-block-uagb-container">
    <!-- child blocks in row layout -->
  </div>
  <!-- /wp:uagb/container -->
</div>
<!-- /wp:uagb/container -->
```

**Critical Rule:** When creating pages via REST API, always include the full attribute set (`block_id`, `backgroundType`, padding values, etc.) in the block comment. Missing attributes = Spectra cannot generate per-block CSS = page renders as unstyled plain text (BUG-002).

### 3.2 Advanced Heading (`uagb/advanced-heading`)
**Purpose:** Styled headings with optional sub-heading, separator line, and text highlighting.

**Settings:**
| Setting | Options |
|---------|---------|
| Heading Tag | h1, h2, h3, h4, h5, h6, p, span |
| Alignment | Left, Center, Right (responsive per breakpoint) |
| Heading Color | Color picker + Global Color Palette |
| Typography | Family, Size, Weight, Transform, Line Height, Letter Spacing (responsive) |
| Sub-Heading | Optional second line with independent typography |
| Separator | None, Solid, Double, Dotted, Dashed — with Color, Width, Thickness |
| Separator Position | Below Heading, Below Sub-Heading, Between |

**Highlight Feature (Pro):**
Mark specific words with visual emphasis:
- **Color** — Different text color for highlighted word
- **Background** — Colored background behind word
- **Circle** — SVG circle drawn around word
- **Underline** — Decorative underline on word
- **Strikethrough** — Line through word

Syntax in editor: Wrap text in `<mark>` tags or use the highlight toolbar button.

**Responsive:** Font size, alignment, and spacing all have separate Desktop/Tablet/Mobile values.

### 3.3 Info Box (`uagb/info-box`)
**Purpose:** Feature/service cards with icon or image + heading + description + CTA. The workhorse block for service grids and feature sections.

**Media Settings:**
| Setting | Options |
|---------|---------|
| Source Type | Icon (FontAwesome), Image, None |
| Icon | Full FontAwesome 5 library (e.g., `fas fa-shield-alt`) |
| Icon Size | px slider |
| Icon Color | Normal + Hover states |
| Icon Background | Color, shape (Circle, Square, None) |
| Image | Upload or Media Library, custom width |
| Position | Above Title, Below Title, Left of Text, Right of Text, Left of Title, Right of Title |

**Content:**
- Heading (h2-h6) with independent typography
- Description paragraph
- Separator line between heading and description (optional)

**CTA (Call To Action):**
| Type | Behavior |
|------|----------|
| None | No clickable element |
| Text | Linked text below description |
| Button | Styled button below description |
| Complete Box | Entire info box is clickable |

- CTA Link URL, Target (new tab), rel (nofollow)
- Button: colors, border, padding, hover effects

**Common Pattern — 3-Column Service Grid:**
```html
<!-- wp:uagb/container {"contentWidth":"alignfull","direction":"row","wrap":"wrap","columnGap":30,"rowGap":30} -->
  <!-- wp:uagb/info-box {"iconimgPosition":"above-title","source_type":"icon","icon":"fas fa-shield-alt","headingTag":"h3","ctaType":"button","ctaText":"Learn More"} -->
  <!-- /wp:uagb/info-box -->
  <!-- wp:uagb/info-box {... service 2 ...} /-->
  <!-- wp:uagb/info-box {... service 3 ...} /-->
<!-- /wp:uagb/container -->
```

**Tip:** Use consistent icon sizes (40-60px) and keep descriptions to 2-3 sentences for clean card layouts.

### 3.4 Call To Action (`uagb/call-to-action`)
**Purpose:** Prominent CTA sections with heading, description, and button(s). Used for conversion-focused strips between content sections.

**Layout Options:**
| Setting | Options |
|---------|---------|
| Layout | Stacked (vertical) or Inline (button beside text) |
| Button Position | Below Title, Right of Title |
| Button Alignment | Left, Center, Right, Full Width |
| Content Alignment | Left, Center, Right |

**Content:**
- Heading (h1-h6) with full typography controls
- Description paragraph with independent typography
- Secondary description (optional)

**Button Settings:**
- **Dual Buttons** — Primary + Secondary button support
- Text, Link URL, Target, Rel
- Icon: Before/After text with FontAwesome
- Colors: Text, Background, Border — Normal + Hover states
- Border: Style, Width, Radius
- Padding (responsive)
- Size presets: Small, Medium, Large, Extra Large

**Background:** Color, Gradient, Image with overlay — inherits from parent Container but can override.

**Best Practice:** Place CTA blocks between content sections in a full-width Container with a contrasting background color to create visual breaks and drive conversion.

### 3.5 Image Gallery (`uagb/image-gallery`)
**Purpose:** Display image collections in multiple layout formats.

**Layout Options:**
| Layout | Description |
|--------|-------------|
| Grid | Even grid with consistent image sizes |
| Masonry | Pinterest-style stacked layout (preserves aspect ratios) |
| Carousel | Horizontal slider with arrows and dots |
| Tiled | Dynamic mosaic layout |

**Settings:**
| Setting | Options |
|---------|---------|
| Columns | 1-8 (responsive per breakpoint) |
| Image Size | Thumbnail, Medium, Large, Full |
| Gap | px between images (Row Gap + Column Gap) |
| Border Radius | Rounded corners on images |
| Hover Effect | Zoom, Grayscale, Blur, None |
| Caption Display | Overlay on hover, Below image, None |
| Lightbox | Enable/disable click-to-expand |
| Pagination | None, Load More button, Numbered pagination |
| Images Per Page | When pagination enabled |

**Carousel-Specific:**
- Autoplay with speed control
- Arrows and dots navigation
- Infinite loop
- Slides to show / scroll
- Transition speed

### 3.6 Testimonials (`uagb/testimonial`)
**Purpose:** Customer/client testimonial displays in grid or carousel format.

**Per-Item Content:**
- Author Name (with typography controls)
- Company/Designation
- Testimonial Text
- Author Image (circle/square crop)
- Star Rating (1-5 stars, color customizable)

**Layout Settings:**
| Setting | Options |
|---------|---------|
| Columns | 1, 2, or 3 |
| Image Position | Top, Left, Right, Stacked |
| Image Style | Circle, Square, with border/shadow options |
| Alignment | Left, Center, Right |
| Heading Tag | h3-h6 for author name |
| Equal Height | Normalize card heights across columns |

**Carousel Mode:**
- Enable carousel for sliding testimonials
- Autoplay with speed (ms)
- Pause on hover
- Arrows: Show/hide, size, color
- Dots: Show/hide, size, color, active color
- Infinite loop
- Transition speed

**Styling:**
- Background color/image per testimonial card
- Border and border radius
- Padding and margin
- Quote icon (enable/disable, color, size)

### 3.7 Team (`uagb/team`)
**Purpose:** Staff/team member profile cards with photo, role, bio, and social links.

**Per-Member Content:**
- Name (with heading tag h1-h6)
- Designation/Title
- Description/Bio
- Profile Photo

**Image Settings:**
| Setting | Options |
|---------|---------|
| Image Style | Normal, Circle, Square |
| Image Width | Custom px |
| Image Position | Top (stacked) or Left/Right (inline) |
| Border & Shadow | Full border/radius/shadow controls |

**Social Media Icons:**
- Enable/disable social section
- Platforms: Twitter/X, Facebook, LinkedIn, Instagram, YouTube, Pinterest, GitHub, Email
- Per-icon URL
- Icon style: Filled, Outlined
- Icon color and hover color
- Icon size and spacing
- Icon shape: Circle, Square, None

**Typography:**
- Independent controls for Name, Designation, Description
- Colors for each text element (normal and hover)

### 3.8 Price List (`uagb/price-list`)
**Purpose:** Menu/pricing display — ideal for restaurant menus, service pricing lists, and product catalogs.

**Per-Item Content:**
- Title (heading text)
- Description
- Price (text — displays as-is, so format with $ or currency)
- Image (optional per item)

**Settings:**
| Setting | Options |
|---------|---------|
| Columns | 1, 2, or 3 |
| Image Position | Left, Right, Top |
| Image Size | Custom width |
| Image Alignment | Top, Middle (when position is left/right) |
| Separator | Line between title/price and description |
| Separator Style | Solid, Dashed, Dotted |
| Separator Color | Color picker |

**Typography:**
- Title: family, size, weight, color
- Price: family, size, weight, color (often bold/accent)
- Description: family, size, color

**Best Practice for Restaurant Menus:** Use 2-column layout with item image on left, separator style as dotted (classic menu look), price in accent color right-aligned.

### 3.9 Tabs (`uagb/tabs`)
**Purpose:** Tabbed content sections — each tab contains arbitrary Gutenberg blocks.

**Settings:**
| Setting | Options |
|---------|---------|
| Tab Count | Number of tabs |
| Active Tab | Which tab is open by default (0-indexed) |
| Tab Alignment | Left, Center, Right, Full Width |
| Layout | Horizontal (tabs on top) or Vertical (tabs on side) |
| Icon | FontAwesome icon per tab (before or after label) |
| Icon Position | Before or After tab label |

**Tab Header Styling:**
- Active Tab: Background Color, Text Color, Border
- Inactive Tab: Background Color, Text Color, Border
- Hover states for inactive tabs
- Typography: Family, Size, Weight
- Border between tabs
- Gap between tab buttons

**Tab Content:**
- Each tab body accepts any Gutenberg blocks
- Background color per tab body
- Padding (responsive)
- Border on content area

**Use Case Examples:**
- Monthly/Annual pricing toggle
- Product feature comparisons
- Service category breakdowns
- FAQ organized by topic

### 3.10 Forms (`uagb/forms`)
**Purpose:** Contact, lead capture, and inquiry forms with email notifications — no plugin required.

**Available Field Types:**
| Field Type | Description |
|------------|-------------|
| Text | Single-line text input |
| Email | Email validation |
| Phone | Phone number |
| Textarea | Multi-line text |
| Select | Dropdown with options |
| Checkbox | Multiple selection checkboxes |
| Radio | Single selection radio buttons |
| URL | Website URL |
| Number | Numeric input with min/max |
| Hidden | Hidden field (for tracking, UTM params) |
| Accept (Toggle) | Consent/terms checkbox |
| Date | Date picker |

**Form Settings:**
| Setting | Options |
|---------|---------|
| Label Position | Above Field, Placeholder (inside field), Hidden |
| Required Fields | Per-field toggle |
| Success Message | Custom text shown after submission |
| Error Message | Custom text for failed submission |
| Redirect | URL to redirect after successful submit |
| Form Name | Internal form identifier |

**Email Notification:**
- To: recipient email address
- Subject: email subject line
- CC / BCC: additional recipients
- Reply To: sender's email field value
- Email body includes all form data

**reCAPTCHA:**
- v2 Checkbox or v3 Invisible
- Site Key and Secret Key in Spectra Settings
- Per-form enable/disable

**Submit Button:**
- Text, size (Small/Medium/Large/Full Width)
- Colors: text, background, border — normal + hover
- Icon: before/after button text
- Loading state indicator

**Styling:**
- Input field: border, radius, background, text color, padding
- Label: typography, color
- Spacing between fields
- Overall form width and alignment

### 3.11 Marketing Button (`uagb/marketing-button`)
**Purpose:** Conversion-focused buttons with primary text + secondary description line. More prominent than standard buttons.

**Content:**
- **Heading** — Main button text (bold/large)
- **Description** — Secondary text line below heading (smaller, lighter)
- **Icon** — FontAwesome icon, position before/after heading
- **Link** — URL, target (new tab), rel (nofollow/sponsored)

**Settings:**
| Setting | Options |
|---------|---------|
| Size | Small, Medium, Large, Extra Large |
| Full Width | Stretch to container width |
| Alignment | Left, Center, Right |
| Icon Position | Before Title, After Title |
| Icon Size | px slider |
| Icon Spacing | Gap between icon and text |

**Styling:**
- Background: Color, Gradient — Normal + Hover
- Text Color: Heading color, Description color — Normal + Hover
- Border: Style, Width, Color, Radius — Normal + Hover
- Padding (responsive)
- Box Shadow — Normal + Hover
- Hover animation: scale effect

**Use Case:** Download buttons ("Download Now / Free 14-day trial"), upgrade prompts ("Get Pro / Save 40% annually"), app store links.

### 3.12 Counter (`uagb/counter`)
**Purpose:** Animated number counters for statistics — counts up on scroll into view.

**Content:**
| Setting | Description | Example |
|---------|-------------|---------|
| Starting Number | Count start value | 0 |
| Ending Number | Count target value | 500 |
| Prefix | Text before number | "$", ">", "" |
| Suffix | Text after number | "+", "%", "K" |
| Title | Label below/above number | "Projects Completed" |
| Thousand Separator | Comma, Period, Space, None | "10,000" |

**Animation:**
- Duration: milliseconds (default 2000ms)
- Trigger: on scroll into viewport (automatic)
- Easing: smooth count-up animation

**Layout:**
- Number + Title stacked (vertical)
- Number alignment: Left, Center, Right
- Icon: optional FontAwesome icon above number
- Icon Size, Color

**Typography:**
- Number: Family, Size, Weight, Color (responsive)
- Title: Family, Size, Weight, Color (responsive)
- Prefix/Suffix: inherits number styling

**Common Pattern — Stats Row:**
```
Container (row, 4 equal columns, center-aligned)
  → Counter ("500+", "Projects")
  → Counter ("50", "Team Members")
  → Counter ("15", "Years Experience")
  → Counter ("98%", "Client Satisfaction")
```

### 3.13 Modal (`uagb/modal`)
**Purpose:** Popup/lightbox content triggered by button, icon, image, or text click. Contains any Gutenberg blocks.

**Trigger Settings:**
| Setting | Options |
|---------|---------|
| Trigger Type | Button, Icon, Image, Text |
| Button Text | Custom label |
| Button Size | Small, Medium, Large |
| Button Icon | FontAwesome, position before/after |
| Icon (if trigger=icon) | FontAwesome icon picker |
| Image (if trigger=image) | Media upload |
| Text (if trigger=text) | Any clickable text |

**Modal Settings:**
| Setting | Options |
|---------|---------|
| Modal Width | Custom px / Full Width |
| Alignment | Center, Top, Bottom, Left, Right |
| Close Icon | Show/hide, position: top-right, top-left, popup-right, popup-left |
| Close Icon Size | px slider |
| Close on Overlay Click | true/false |
| Close on ESC | true/false |
| Overlay Color | Color + opacity |

**Content:** The modal body accepts any Gutenberg blocks — text, forms, images, videos, pricing tables, etc.

**Styling:**
- Modal Background: Color, Image, Gradient
- Border: Style, Width, Color, Radius
- Box Shadow
- Padding (responsive — Desktop/Tablet/Mobile)
- Trigger button: Colors (normal + hover), border, typography

**Use Cases:**
- Lead capture popup (form inside modal)
- Video showcase (embed inside modal)
- Terms & conditions overlay
- Quick view product details
- Image lightbox replacement

**Tip:** For exit-intent popups, combine with Display Conditions (Pro) or use Astra Custom Layouts with popup type instead.

### 3.14 Slider (`uagb/slider`)
**Purpose:** Full content slider — each slide holds any Gutenberg blocks (not just images).

**Slide Content:** Each slide is a container accepting any blocks — headings, text, images, buttons, forms, etc. This makes it a hero carousel, testimonial slider, or feature showcase.

**Carousel Settings:**
| Setting | Options |
|---------|---------|
| Slide Count | Number of slides |
| Autoplay | true/false |
| Autoplay Speed | Milliseconds (default 3000) |
| Pause on Hover | true/false |
| Infinite Loop | true/false (continuous cycling) |
| Transition Speed | Milliseconds (slide transition duration) |
| Transition Effect | Slide, Fade |

**Navigation Controls:**
| Setting | Options |
|---------|---------|
| Show Arrows | true/false |
| Arrow Size | px slider |
| Arrow Color | Color picker (normal + hover) |
| Arrow Background | Color + border radius |
| Arrow Position | Inside, Outside |
| Show Dots | true/false |
| Dot Size | px slider |
| Dot Color | Active color, Inactive color |
| Dot Gap | Spacing between dots |

**Layout:**
- Slide Height: Fixed px or Auto (content-driven)
- Content Alignment: Left, Center, Right
- Vertical Alignment: Top, Middle, Bottom
- Slide Background: Color, Image, Gradient per slide
- Padding: responsive per slide

**Common Pattern — Hero Carousel:**
```
Slider (autoplay: true, 5000ms, fade transition, infinite loop)
  → Slide 1: Container (bg image, overlay) → Heading + Button
  → Slide 2: Container (bg image, overlay) → Heading + Button
  → Slide 3: Container (bg image, overlay) → Heading + Button
```

### 3.15 Content Timeline (`uagb/content-timeline`)
**Purpose:** Chronological events, milestones, process steps — vertical timeline with connector line and icons.

**Per-Item Content:**
- Heading (h1-h6 tag selectable)
- Description (paragraph text)
- Date / Label (displayed beside timeline node)
- Icon (FontAwesome icon per item)

**Layout Settings:**
| Setting | Options |
|---------|---------|
| Timeline Items | Number of items (add/remove dynamically) |
| Layout | Left-aligned, Right-aligned, Alternating (left-right) |
| Icon Align | Left, Right, Center |
| Heading Tag | h1-h6 |
| Date Format | Custom text (not date-picker — enters as plain string) |

**Connector & Icon Styling:**
| Setting | Options |
|---------|---------|
| Connector Line Width | px (default 3px) |
| Connector Line Color | Color picker |
| Icon Size | px slider |
| Icon Color | Normal + Focus (when scrolled past) |
| Icon Background | Normal + Focus |
| Icon Border | Width, Color, Radius |
| Separator (dot) Size | px |

**Content Styling:**
- Background: Color per item card
- Border: Style, Width, Color, Radius on card
- Padding: responsive
- Typography: Heading (family, size, weight, color), Date, Description
- Arrow indicator from connector to card

**Scroll Animation:** Items highlight as user scrolls — the connector line fills with the "focus" color and icons change to focus state.

**Use Cases:** Company history, project milestones, process steps ("How it Works"), event schedule, roadmap.

### 3.16 FAQ / Accordion (`uagb/faq`)
**Purpose:** Expandable question-answer sections or accordion panels with optional FAQ Schema markup for SEO.

**Per-Item Content:**
- Question (heading text — clickable toggle)
- Answer (rich content — accepts Gutenberg blocks, not just text)

**Settings:**
| Setting | Options |
|---------|---------|
| Layout | Accordion (vertical stack), Grid (multi-column) |
| Columns (grid only) | 1-4 |
| Expand First Item | true/false (first item open on load) |
| Collapse Others | true/false (true = accordion behavior: only one open) |
| Question Tag | h2, h3, h4, h5, h6, p, span |
| Icon Align | Left (before question), Right (after question) |
| Open/Close Icons | FontAwesome icon pair (default +/−, or chevron, arrow) |
| Enable Schema | true/false — adds `FAQPage` JSON-LD for Google rich results |

**Styling — Question (Collapsed/Active):**
| Setting | States |
|---------|--------|
| Background Color | Inactive, Active (open) |
| Text Color | Inactive, Active |
| Border | Bottom border between items, or full border |
| Padding | Responsive |
| Typography | Family, Size, Weight |
| Icon Color | Inactive, Active |
| Icon Size | px |

**Styling — Answer:**
- Background Color
- Text Color, Typography
- Padding (responsive)
- Border between items

**FAQ Schema (SEO):**
When `enableSchemaSupport: true`, Spectra injects `application/ld+json` with `FAQPage` schema containing each Q&A pair. This enables Google FAQ rich results — expandable answers directly in search results.

**Best Practice:** Enable schema on genuine FAQ pages only. Do not use on accordion sections that aren't actual Q&A (Google may flag as schema abuse).

### 3.17 Loop Builder (`uagb/loop-builder`) — Pro
**Purpose:** Dynamic content grids pulling from any post type — blog posts, WooCommerce products, custom post types. Replaces the need for custom PHP query loops.

**Query Settings:**
| Setting | Options |
|---------|---------|
| Post Type | Posts, Pages, Products, Custom Post Types |
| Taxonomy Filter | Categories, Tags, Custom Taxonomies |
| Include/Exclude | Specific post IDs |
| Order By | Date, Title, Random, Menu Order, Modified Date, Comment Count |
| Order | ASC / DESC |
| Posts Per Page | Number |
| Offset | Skip first N posts |
| Sticky Posts | Include, Exclude, Only |

**Layout Settings:**
| Setting | Options |
|---------|---------|
| Layout | Grid, Masonry, Carousel |
| Columns | 1-6 (responsive per breakpoint) |
| Column Gap | px |
| Row Gap | px |
| Equal Height | true/false (for grid) |

**Carousel Options (when layout = carousel):**
- Slides to show: 1-6
- Slides to scroll: 1-6
- Autoplay, speed, pause on hover
- Arrows, dots navigation
- Infinite loop

**Template Customization:**
Each loop item is a container with inner blocks — you design the card template once, and it repeats for each post:
- Post Title block (dynamic)
- Post Image / Featured Image block (dynamic)
- Post Excerpt block (dynamic)
- Post Meta (date, author, categories)
- Read More button
- Custom static blocks alongside dynamic content

**Pagination:**
- Load More button
- Page numbers
- Infinite scroll

**Mass Production Tip:** Use Loop Builder for blog listing pages, portfolio grids, team directories, and product showcases. Design the card template once — content populates dynamically from WordPress.

### 3.18 Block Presets
**Location:** Block toolbar → Presets icon (palette icon)

**Purpose:** Save and reuse block styling configurations across pages and sites. Critical for mass production consistency.

**How It Works:**
1. Style a block (colors, typography, spacing, borders, etc.)
2. Click the Presets icon in the block toolbar
3. Save as a named preset
4. On any other instance of that block type, click Presets → apply saved style

**Preset Operations:**
| Action | Description |
|--------|-------------|
| Apply Preset | One-click apply saved style to current block |
| Save as Preset | Save current block's styling as new preset |
| Copy/Paste Style | Copy style from one block, paste to another (even different block type) |
| Default Presets | Spectra ships pre-built presets per block (professional starting points) |

**Import/Export (Pro):**
- Export all presets as JSON file
- Import presets on another site
- Share preset libraries across team/agency

**Mass Production Tip:** Build a preset library for your brand: hero container preset, service card preset, CTA section preset, testimonial card preset. New sites get consistent styling in seconds by applying presets instead of manually configuring each block.

### 3.19 Display Conditions (Pro)
**Purpose:** Show/hide any Spectra block based on dynamic rules — without custom code. Applied per-block via sidebar settings.

**Location:** Select any Spectra block → Block Settings sidebar → Display Conditions

**Condition Categories:**
| Category | Conditions Available |
|----------|---------------------|
| **User** | Logged In, Logged Out, User Role (admin, editor, author, subscriber, customer, etc.) |
| **Responsive** | Desktop Only, Tablet Only, Mobile Only |
| **Browser** | Chrome, Firefox, Safari, Edge, Opera |
| **OS** | Windows, macOS, Linux, iOS, Android |
| **Date & Time** | Day of Week, Specific Date Range, Time Range |
| **URL** | URL Contains Parameter, Specific Page/Post, Post Type |
| **WooCommerce** | In Cart, Cart Empty, Purchased Product (if WooCommerce active) |

**Logic:**
- Multiple conditions = AND logic (all must be true)
- Each condition can be set to SHOW or HIDE when matched
- Combine conditions: e.g., "Show only on Mobile AND only to Logged-In Users"

**Examples:**
- Show "Download App" CTA only on mobile devices
- Show admin-only debugging info block to admin role users
- Hide seasonal banner after December 31
- Show different pricing for logged-in vs logged-out users
- Display WooCommerce promo only when cart is empty

**Key Difference from Astra Custom Layouts:**
- **Display Conditions** = per-block visibility within a page
- **Astra Custom Layouts** = inject entire content sections at hook locations across the site

**Mass Production Tip:** Use display conditions to build one page with mobile-specific and desktop-specific content blocks rather than maintaining two separate pages.

### 3.20 Animations & Scroll Effects
**Location:** Select any Spectra block → Block Settings sidebar → Spectra Animations

**Animation Types:**
| Type | Variants |
|------|----------|
| Fade | In, In Up, In Down, In Left, In Right |
| Slide | Up, Down, Left, Right |
| Zoom | In, In Up, In Down, In Left, In Right, Out |
| Flip | In X, In Y |
| Bounce | In, In Up, In Down, In Left, In Right |
| Rotate | In, In Down Left, In Down Right, In Up Left, In Up Right |
| Special | Flash, Pulse, Rubber Band, Shake, Swing, Tada, Wobble, Jello |

**Animation Settings:**
| Setting | Options |
|---------|---------|
| Delay | Milliseconds (0, 100, 200, ... 3000) |
| Duration | Milliseconds (default 1000) |
| Repeat | Once, Infinite |
| Trigger | On Scroll Into View (default) |

**Best Practices:**
- **Keep it subtle** — Fade In Up with 200-400ms duration is the most professional. Avoid bouncing/flashing on business sites.
- **Stagger delays** — For multiple items in a row (3 service cards), set delays of 0ms, 200ms, 400ms for a cascading reveal effect.
- **Performance** — Animations add CSS classes/keyframes. Avoid animating more than 10-15 blocks per page to prevent jank.
- **Mobile** — Animations trigger on scroll on all devices. Shorter durations work better on mobile.
- **Accessibility** — Respect `prefers-reduced-motion` — Spectra should honor this media query automatically.

**Common Patterns:**
- Hero heading: Fade In Up, 400ms
- Service cards row: Fade In Up, staggered 0/200/400ms delays
- Stats counters: Fade In, 600ms (counters have built-in count animation)
- CTA section: Fade In, 300ms
- Testimonials: Slide In Left, 500ms

---

## 4. Astra Customizer Settings {#customizer-settings}

### Global Settings

| Setting | Location | Key Options |
|---------|----------|-------------|
| **Colors** | Global → Colors | Primary, Secondary, Accent, Heading, Body Text, Link, Link Hover |
| **Typography** | Global → Typography | Body: family, size, weight, line-height. Headings: H1-H6 individual settings |
| **Container** | Global → Container | Width (px), layout (full-width/boxed/content-boxed/narrow), sidebar |
| **Buttons** | Global → Buttons | Primary + Secondary: colors, radius, padding, font, border, hover states |
| **Scroll to Top** | Global → Scroll to Top | Enable, icon, position, offset, mobile visibility |

### Per-Page Settings (Page/Post Editor Sidebar)
Every page/post has an "Astra Settings" metabox:
- **Content Layout:** Boxed, Full Width, Narrow
- **Sidebar:** Default, Left, Right, None
- **Disable Header/Footer/Title** (useful for landing pages)
- **Transparent Header** toggle
- **Page Header (Banner)** settings override

---

## 5. Page Building Patterns {#page-patterns}

### Pattern: Landing Page
```
Container (full-width, hero image bg, dark overlay)
  → Advanced Heading (white, centered, h1)
  → Paragraph (white, centered)
  → Marketing Button (primary CTA)

Container (full-width, white bg)
  → Container (row direction, 3 columns)
    → Info Box (icon above, service 1)
    → Info Box (icon above, service 2)
    → Info Box (icon above, service 3)

Container (full-width, light gray bg)
  → Advanced Heading (section title)
  → Counter (row, 4 items: clients, projects, years, etc.)

Container (full-width, dark bg)
  → Testimonial (carousel, 3 items)

Container (full-width, primary color bg)
  → Call To Action (centered, white text, contact button)
```

### Pattern: Services Page
```
Container (hero banner)
  → Advanced Heading
  → Paragraph (intro text)

Container (services grid)
  → Container (row, wrap)
    → Info Box ×6 (icon + title + description + link)

Container (process section)
  → Content Timeline (4 steps)

Container (CTA section)
  → Call To Action
```

### Pattern: About Page
```
Container (team intro)
  → Advanced Heading
  → Paragraph

Container (team grid)
  → Team ×4 (photo + name + role + social)

Container (stats)
  → Counter ×4 (animated numbers)

Container (testimonials)
  → Testimonial (carousel)
```

### Pattern: Contact Page
```
Container (two-column)
  → Container (left - 60%)
    → Forms (contact form)
  → Container (right - 40%)
    → Info Box (address, icon: map-marker)
    → Info Box (phone, icon: phone)
    → Info Box (email, icon: envelope)
    → Google Maps embed
```

### Pattern: Pricing Page
```
Container (pricing header)
  → Advanced Heading
  → Tabs (monthly/annual toggle)

Container (pricing cards)
  → Container (row, 3 columns)
    → Container (card 1 - basic)
      → Advanced Heading
      → Price List
      → Marketing Button
    → Container (card 2 - pro, highlighted)
    → Container (card 3 - enterprise)

Container (FAQ section)
  → FAQ (accordion, schema-enabled)
```

---

## 6. WooCommerce Integration {#woocommerce}

### Astra Pro WooCommerce Module
**Location:** Customizer → WooCommerce

**Shop Page:**
- Grid columns (2-6)
- Product hover styles (swap image, fade)
- Add to cart button position
- Product card style (outline, shadow)
- Quick View popup

**Single Product:**
- Gallery layout: vertical thumbnails, horizontal, no thumbnails
- Product structure: title, price, rating, add-to-cart, meta
- Related products count and columns
- Up-sells display

**Checkout:**
- Modern checkout layout (multi-step or one-page)
- Order summary sidebar
- Distraction-free checkout (removes header/footer)
- Custom checkout fields

### WooCommerce Spectra Blocks
- `uagb/price-list` — Product pricing display
- `uagb/loop-builder` — Dynamic product grids
- WooCommerce's native blocks also work alongside Spectra

---

## 7. REST API Patterns {#rest-api}

### Authentication
```bash
# Basic Auth with Application Password
curl -u "username:app-password" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  "https://site.com/wp-json/wp/v2/pages"
```

### Safe Content Edits — Surgical Copy Transplant (Validated 2026-03-06)

**The proven workflow for swapping ALL visible text on a Spectra template page via REST API, preserving 100% of block structure, styling, and Gutenberg editor compatibility.**

**DON'T:** Replace entire content with new block markup (destroys Spectra CSS generation — BUG-002/003).

**DO:** Surgical text-only `str.replace()` within existing block HTML.

#### Step 1 — Fetch Raw Content
```bash
# Must use context=edit to get raw block markup (not rendered HTML)
curl -s -u "user:pass" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  "https://site.com/wp-json/wp/v2/pages/123?context=edit" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['content']['raw'])" \
  > /tmp/page-123-original.txt
```

#### Step 2 — Extract All Swappable Text (Python)
```python
import re
with open('/tmp/page-123-original.txt') as f:
    content = f.read()

# ALL text classes in Spectra info-box/heading blocks:
# 1. Headings (h1-h6)
headings = re.findall(r'<h[1-6][^>]*class="uagb-heading-text"[^>]*>(.*?)</h[1-6]>', content)

# 2. Info-box titles — INCLUDES card titles AND checklist items
titles = re.findall(r'<[ph][1-6]? class="uagb-ifb-title">(.*?)</[ph][1-6]?>', content, re.DOTALL)

# 3. Info-box descriptions
descs = re.findall(r'<p class="uagb-ifb-desc">(.*?)</p>', content, re.DOTALL)

# 4. Button labels
buttons = re.findall(r'<div class="uagb-button__link">(.*?)</div>', content)

# 5. tempHeadingDesc attributes (JSON in block comments — some blocks have this)
temps = re.findall(r'"tempHeadingDesc":"([^"]+)"', content)
```

#### Step 3 — Spectra Info-Box Block Type Taxonomy
**Critical discovery:** Spectra templates use 3 distinct info-box block patterns:

| Type | `headingTag` | `iconimgPosition` | `tempHeadingDesc` | Text Location |
|------|-------------|-------------------|-------------------|---------------|
| **Card Title** | `h4` | (default/empty) | Has content | HTML + JSON attribute (replace BOTH) |
| **Section Heading** | `h1`/`h2` | (default/empty) | Has content | HTML + JSON attribute (replace BOTH) |
| **Checklist Item** | `p` | `left-title` | Empty string `""` | HTML only (single replace) |

**Checklist items look like lists but are mini info-box blocks** with a checkmark SVG icon. They use `<p class="uagb-ifb-title">` — the same CSS class as card titles. There are NO `wp:list` or `uagb/icon-list` blocks in the Electrician template.

#### Step 4 — Execute Replacements (Python)
```python
import json

replacements = [
    # (old_text, new_text) — one pair per visible string
    ("Old Heading", "New Heading"),
    ("Old description text.", "New description text."),
    ("Old checklist item", "New checklist item"),
    # ... full list for the page
]

for old, new in replacements:
    count = content.count(old)
    if count > 0:
        content = content.replace(old, new)
        print(f"✅ '{old}' → '{new}' ({count}x)")
    else:
        print(f"❌ NOT FOUND: '{old}'")
```

**Important:** For card titles and section headings, each text appears **twice** — once in the HTML and once in the `tempHeadingDesc` JSON attribute. `str.replace()` catches both automatically. For checklist items (empty `tempHeadingDesc`), text appears only once.

#### Step 5 — Block Integrity Verification (MANDATORY)
```python
import re
block_tags = re.findall(r'<!-- wp:uagb/\w+', content)
block_ids = re.findall(r'"block_id":"([a-f0-9]+)"', content)
print(f"Block tags: {len(block_tags)}")  # Must match original count
print(f"Block IDs:  {len(block_ids)}")   # Must match original count
# If either count changes, the transplant corrupted block structure — ABORT
```

#### Step 6 — Push via curl (NOT Python urllib)
```bash
# Save payload as JSON file first (avoids shell escaping issues)
python3 -c "
import json
with open('/tmp/page-123-modified.txt') as f:
    content = f.read()
with open('/tmp/page-123-payload.json', 'w') as f:
    json.dump({'content': content}, f)
"

# Push with curl (Python 3.13 on macOS has SSL cert issues — use curl)
curl -s -X PUT \
  -u "user:pass" \
  -H "User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)" \
  -H "Content-Type: application/json" \
  -d @/tmp/page-123-payload.json \
  "https://site.com/wp-json/wp/v2/pages/123"
```

#### Step 7 — Verify Frontend + Editor
1. **Frontend:** Navigate to page URL — all text should show new content with full Spectra styling
2. **Editor:** Open in Gutenberg — all blocks must be editable (NOT empty container placeholders)
3. If editor shows empty blocks → transplant corrupted block_ids → restore from backup

### Page Management
```bash
# List all pages
curl -u "user:pass" "https://site.com/wp-json/wp/v2/pages?per_page=100"

# Create draft page
curl -X POST "https://site.com/wp-json/wp/v2/pages" \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Page","status":"draft","content":"<!-- wp:uagb/container -->..."}'

# Update page title only (safe — doesn't touch content)
curl -X PUT "https://site.com/wp-json/wp/v2/pages/123" \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'

# Publish a draft
curl -X PUT "https://site.com/wp-json/wp/v2/pages/123" \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"status":"publish"}'
```

### Media Upload
```bash
curl -X POST "https://site.com/wp-json/wp/v2/media" \
  -u "user:pass" \
  -H "Content-Disposition: attachment; filename=hero.jpg" \
  --data-binary @hero.jpg
```

### Plugin Management
```bash
# Install from WordPress.org
curl -X POST "https://site.com/wp-json/wp/v2/plugins" \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"slug":"spectra","status":"active"}'

# Activate existing plugin
curl -X PUT "https://site.com/wp-json/wp/v2/plugins/spectra/starter-templates" \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}'
```

---

## 8. Mass Production Playbook {#mass-production}

### Site Factory Workflow

**Phase 1 — Template Selection (5 min)**
1. Review client industry and requirements
2. Browse Starter Templates for best match
3. Import template to new WordPress install

**Phase 2 — Brand Application (10 min)**
1. Customizer → Colors → Set client brand palette
2. Customizer → Typography → Set client fonts (or keep Astra defaults)
3. Header Builder → Upload logo, adjust menu
4. Footer Builder → Copyright, contact info, social links

**Phase 3 — Content Swap (15-30 min with API, 30-60 min manual)**
1. **Preferred: REST API surgical transplant** (see Section 7 — Copy Transplant workflow)
   - GET raw content → Python str.replace() → verify block integrity → PUT
   - Handles headings, titles, descriptions, buttons, AND checklist items
   - ~5 min per page programmatically
2. **Fallback: Manual Gutenberg editing** (preserve Spectra block structure)
   - Replace placeholder text with client copy
   - Replace placeholder images with client media
3. Update contact form email addresses
4. Configure WooCommerce if applicable

**Phase 4 — QA & Launch (15 min)**
1. Mobile responsive check
2. All links work, forms submit
3. Page speed acceptable (<3s load)
4. SEO basics: titles, descriptions, Open Graph
5. SSL active, redirects working
6. Go live: update DNS, switch from staging

### Scaling Tips
- **Create a "base site" template** — Customize one Starter Template with common settings, export, reimport for new clients
- **Standardize the color system** — Only change Global Colors; Spectra blocks inherit from theme
- **Use Block Presets** — Save commonly used block configurations (hero sections, CTA strips, footer layouts)
- **Reusable Blocks** — Create reusable blocks for standard sections (privacy policy, terms, common CTAs)
- **Custom Layouts library** — Build a collection of Astra Custom Layouts for common needs (popup CTA, announcement bar, etc.)

### Known Limitations & Workarounds

| Issue | Workaround |
|-------|------------|
| REST API content push breaks Spectra styling | Use surgical Python str.replace() on raw content (see Section 7). Never replace entire content field. |
| "Checklist items" are info-box blocks, not lists | They use `uagb/info-box` with `iconimgPosition: "left-title"` and `headingTag: "p"`. Same `uagb-ifb-title` CSS class as card titles. |
| Python 3.13 on macOS SSL cert errors | Use curl instead of Python urllib for WordPress REST API PUT requests |
| Browser automation can't upload plugin zips | Use WP-CLI, FTP, or manual upload |
| Mega menus need manual config per site | Create mu-plugin template, deploy via FTP |
| Starter Template import is all-or-nothing | Use partial import for individual pages |
| Header/Footer Builder is visual-only | Must configure via Customizer (browser), not REST API |

---

## 9. Global Block Styles & Theming {#global-styles}

### Astra Global Color Palette
**Location:** Customizer → Global → Colors

Astra provides **4 color palettes**, each with **9 color slots** (0-8). Spectra blocks inherit these colors via CSS variables.

**CSS Variables:**
| Variable | Default Role | Typical Usage |
|----------|-------------|---------------|
| `--ast-global-color-0` | Primary | Buttons, links, accents |
| `--ast-global-color-1` | Secondary | Hover states, secondary accents |
| `--ast-global-color-2` | Heading Text | H1-H6 headings |
| `--ast-global-color-3` | Body Text | Paragraph text |
| `--ast-global-color-4` | Border/Subtle | Borders, dividers, light elements |
| `--ast-global-color-5` | Light Background | Section backgrounds (light gray) |
| `--ast-global-color-6` | Dark Background | Footer, dark sections |
| `--ast-global-color-7` | Highlight | Badges, tags, callouts |
| `--ast-global-color-8` | White/Light | Card backgrounds, overlays |

**How It Works:**
1. Set brand colors in Customizer → Global → Colors
2. Spectra blocks automatically offer these as preset colors in every color picker
3. When you change a global color, all blocks using that variable update instantly
4. CSS in theme: `color: var(--ast-global-color-0);`

**Mass Production Tip:** Changing global colors is the single fastest way to rebrand an entire site. Import starter template → change 4-5 global colors → entire site reflects new brand.

### Astra Global Typography
**Location:** Customizer → Global → Typography

| Setting | Options |
|---------|---------|
| Body Font Family | Google Fonts or System Stack |
| Body Font Size | px/em/rem (responsive) |
| Body Font Weight | 100-900 |
| Body Line Height | unitless (e.g., 1.6) |
| Body Letter Spacing | px |
| Body Text Transform | None, Uppercase, Lowercase, Capitalize |
| Heading Font (H1-H6) | Individual family, size, weight, line-height, letter-spacing, color |

**Spectra Inheritance:** Spectra blocks (Advanced Heading, Info Box title, etc.) inherit body/heading fonts from Astra. Override per-block when needed.

### Spectra Global Default Styling
**Location:** Spectra → Settings → Block Defaults (Pro)

Set default values for any Spectra block attribute globally:
- Default Container padding, background
- Default Heading colors, fonts
- Default Button sizes, colors
- Default Form field styling

Changes apply to all new blocks. Existing blocks retain their current settings.

---

## 10. Responsive Design {#responsive-design}

### Astra Responsive Controls
Most Astra Customizer settings include responsive toggles (Desktop/Tablet/Mobile icons):
- Header/Footer: Different layouts per breakpoint
- Typography: Different sizes per breakpoint
- Spacing: Different margins/padding per breakpoint
- Sidebar: Show sidebar on desktop, hide on mobile
- Container width per breakpoint

### Spectra Responsive Controls
Every spacing, sizing, and layout setting in Spectra blocks has Desktop/Tablet/Mobile values:

**Responsive Properties:**
| Property | Desktop | Tablet | Mobile |
|----------|---------|--------|--------|
| Padding | 40px | 30px | 20px |
| Margin | 20px | 15px | 10px |
| Font Size | 48px | 36px | 28px |
| Columns | 3 | 2 | 1 |
| Column Gap | 30px | 20px | 15px |
| Visibility | Show | Show | Hide (if needed) |

**Container Direction:** Can change from `row` on desktop to `column` on mobile — this is how multi-column layouts stack on small screens.

### Breakpoints
**Astra Default Breakpoints:**
| Breakpoint | Width | Applies To |
|------------|-------|------------|
| Desktop | > 921px | Default styles |
| Tablet | 769px - 921px | Tablet overrides |
| Mobile | < 769px | Mobile overrides |

**Spectra follows Astra breakpoints** by default for consistency.

### Responsive Best Practices
1. **Design mobile-first:** Start with mobile content order, then enhance for desktop
2. **Stack columns:** 3-4 columns on desktop → 1-2 on mobile via Container direction change
3. **Reduce padding:** Desktop 60px top/bottom → Mobile 30px
4. **Font scaling:** H1 Desktop 48px → Mobile 28-32px
5. **Hide decorative elements:** Use Display Conditions or responsive visibility to hide non-essential blocks on mobile
6. **Test at 375px width:** iPhone SE — the narrowest common screen

---

## 11. Troubleshooting & Common Issues {#troubleshooting}

### BUG-002: REST API Content Push Breaks Spectra Styling
**Symptom:** Page renders as unstyled plain text after REST API `PUT /wp-json/wp/v2/pages/{id}`.
**Cause:** Full content replacement strips Spectra block attributes (block_id, backgroundType, overlayOpacity, padding values, responsive breakpoints). Without these attributes, Spectra cannot generate per-block CSS.
**Fix:** Never do full content replacement via REST API. Use surgical `sed` text replacement to change only text content within existing block structure. See Section 7 for the safe pattern.

### ModSecurity 403 Errors on REST API Calls
**Symptom:** `403 Forbidden` response from REST API.
**Cause:** SiteGround ModSecurity blocks requests without proper User-Agent.
**Fix:** Always include `User-Agent: ASI360-Sentinel/1.0.0 (+https://asi360.co; contact=ops@asi360.co)` header.

### Browser Automation Cannot Upload Files
**Symptom:** `file_upload` returns `{"code":-32000,"message":"Not allowed"}`.
**Cause:** Chrome DevTools Protocol blocks programmatic file input for security.
**Fix:** Use WP-CLI, FTP, or manual upload. See BUG-001 in bugs-and-lessons.md for full analysis.

### WIN-001/002: Surgical Copy Transplant Works End-to-End (Validated 2026-03-06)
**Proved on:** Page 490 (Projects) — sandbox.asi360.co/asi360/projects/
**Result:** 67/67 blocks preserved, 67/67 block_ids preserved, all text transplanted (headings, titles, descriptions, checklist items, buttons). Frontend renders with full styling. Gutenberg editor shows all blocks as fully editable. Zero electrician content remains.

### Spectra Blocks Show Empty / No Styling
**Symptom:** Spectra blocks are present in editor but render with no CSS on frontend.
**Possible Causes:**
1. Spectra CSS generation failed — clear Spectra cache: Dashboard → Spectra → Settings → Regenerate CSS
2. Caching plugin serving stale version — purge all caches (SiteGround, plugin, CDN)
3. Block attributes missing (see BUG-002)
4. Spectra plugin deactivated or outdated
5. Conflict with another page builder plugin (check for Elementor/Divi/Flatsome)

### Starter Template Import Fails
**Possible Fixes:**
1. Increase PHP memory: `define('WP_MEMORY_LIMIT', '256M');` in `wp-config.php`
2. Increase max execution time: `set_time_limit(300);`
3. Try importing via WP-CLI instead of browser: `wp astra-sites import <id> --yes`
4. Check for plugin conflicts — deactivate all non-Astra plugins, reimport, reactivate

### Header/Footer Builder Not Saving
**Possible Causes:**
1. Browser caching stale Customizer state — hard refresh (Ctrl+Shift+R)
2. Multiple Customizer tabs open — close all but one
3. PHP memory limit too low for Customizer save
4. File permissions on `wp-content/uploads/` directory

### Container Block Not Full Width
**Checklist:**
1. Content Width → `alignfull` in block settings
2. Page template → "Full Width / Stretched" (not default boxed)
3. Astra Customizer → Container → Layout must allow full-width
4. Parent container is not restricting width

### Google Fonts Not Loading
**Possible Fixes:**
1. Astra Customizer → Performance → Load Google Fonts Locally (recommended for GDPR)
2. Check for font-loading plugin conflicts
3. Verify font name spelling matches exactly
4. Check browser Network tab for blocked font requests

---

## Documentation Sources

- Astra Pro docs: https://wpastra.com/docs/
- Spectra docs: https://wpspectra.com/docs/
- Astra changelog: https://wpastra.com/changelog/
- Spectra block list: https://wpspectra.com/blocks/
- WordPress REST API: https://developer.wordpress.org/rest-api/
- WP-CLI commands: https://wpastra.com/docs/wp-cli-commands/
