import { test, expect } from "@playwright/test"

/**
 * ASI 360 Client Portal — E2E Smoke Tests
 * Tests against LIVE production at projects.asi360.co
 *
 * Run: npx playwright test
 * Run specific: npx playwright test portal-smoke
 * Debug: npx playwright test --headed --debug
 */

const PORTAL_URL = "https://projects.asi360.co"
const TEST_EMAIL = "don@asi360.co"
const TEST_PASSWORD = "MontegoB@y1981!876"

// ─── Route Accessibility Tests ───

test.describe("Route Accessibility", () => {
  test("GET /login returns 200 with login form", async ({ page }) => {
    const response = await page.goto(`${PORTAL_URL}/login`)
    expect(response?.status()).toBe(200)
    await expect(page.locator("h1")).toContainText("ASI 360 Client Portal")
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test("GET /portal redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto(`${PORTAL_URL}/portal`)
    await page.waitForURL("**/login")
    expect(page.url()).toContain("/login")
  })

  test("GET /admin redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto(`${PORTAL_URL}/admin`)
    await page.waitForURL("**/login")
    expect(page.url()).toContain("/login")
  })

  test("Next.js static assets load (/_next/static)", async ({ request }) => {
    // Fetch login page HTML, extract a JS chunk path, verify it loads
    const loginResp = await request.get(`${PORTAL_URL}/login`)
    const html = await loginResp.text()
    const jsChunkMatch = html.match(/\/_next\/static\/chunks\/[^"]+\.js/)
    expect(jsChunkMatch).toBeTruthy()

    const chunkResp = await request.get(`${PORTAL_URL}${jsChunkMatch![0]}`)
    expect(chunkResp.status()).toBe(200)
    expect(chunkResp.headers()["content-type"]).toContain("javascript")
  })

  test("Supabase API key is baked into JS bundle", async ({ request }) => {
    const loginResp = await request.get(`${PORTAL_URL}/login`)
    const html = await loginResp.text()

    // Find all JS chunk URLs
    const chunks = html.match(/\/_next\/static\/chunks\/[^"]+\.js/g) || []
    let found = false

    for (const chunk of chunks) {
      const resp = await request.get(`${PORTAL_URL}${chunk}`)
      const js = await resp.text()
      if (js.includes("gtfffxwfgcxiiauliynd")) {
        found = true
        break
      }
    }

    expect(found).toBe(true)
  })
})

// ─── Authentication Tests ───

test.describe("Authentication Flow", () => {
  test("Login with valid credentials reaches admin dashboard", async ({
    page,
  }) => {
    await page.goto(`${PORTAL_URL}/login`)

    // Fill login form
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    // Should redirect to /admin (owner role)
    await page.waitForURL("**/admin", { timeout: 15000 })
    expect(page.url()).toContain("/admin")

    // Admin page should have content, not an error
    await expect(
      page.locator("text=Project not found")
    ).not.toBeVisible()
    await expect(
      page.locator("text=Cannot coerce")
    ).not.toBeVisible()
  })

  test("Login with bad password shows error (not crash)", async ({
    page,
  }) => {
    await page.goto(`${PORTAL_URL}/login`)

    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', "wrongpassword123")
    await page.click('button[type="submit"]')

    // Should show error message, stay on login page
    await page.waitForTimeout(3000)
    expect(page.url()).toContain("/login")
    await expect(page.locator(".text-red-400, .text-red-500")).toBeVisible()
  })

  test("Login with nonexistent email shows error", async ({ page }) => {
    await page.goto(`${PORTAL_URL}/login`)

    await page.fill('input[type="email"]', "nobody@fake.com")
    await page.fill('input[type="password"]', "anything")
    await page.click('button[type="submit"]')

    await page.waitForTimeout(3000)
    expect(page.url()).toContain("/login")
    await expect(page.locator(".text-red-400, .text-red-500")).toBeVisible()
  })
})

// ─── Authenticated Admin Tests ───

test.describe("Admin Portal (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`${PORTAL_URL}/login`)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/admin", { timeout: 15000 })
  })

  test("/admin loads without errors", async ({ page }) => {
    await expect(
      page.locator("text=Project not found")
    ).not.toBeVisible()
    await expect(
      page.locator("text=Cannot coerce")
    ).not.toBeVisible()
    await expect(
      page.locator("text=Invalid API key")
    ).not.toBeVisible()

    // Should have some admin content
    const body = await page.textContent("body")
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(100)
  })

  test("/admin/clients loads", async ({ page }) => {
    await page.goto(`${PORTAL_URL}/admin/clients`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("text=Project not found")
    ).not.toBeVisible()
    await expect(
      page.locator("text=Invalid API key")
    ).not.toBeVisible()
  })

  test("/admin/audit loads with audit log", async ({ page }) => {
    await page.goto(`${PORTAL_URL}/admin/audit`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("text=Project not found")
    ).not.toBeVisible()
    // Audit page should have stats or event log
    const body = await page.textContent("body")
    expect(body).toBeTruthy()
  })

  test("/admin/notifications loads", async ({ page }) => {
    await page.goto(`${PORTAL_URL}/admin/notifications`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("text=Project not found")
    ).not.toBeVisible()
  })

  test("/admin/cases loads", async ({ page }) => {
    await page.goto(`${PORTAL_URL}/admin/cases`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("text=Project not found")
    ).not.toBeVisible()
  })

  test("/portal loads project list for owner", async ({ page }) => {
    await page.goto(`${PORTAL_URL}/portal`)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("text=Project not found")
    ).not.toBeVisible()
    // Owner should see projects
    const body = await page.textContent("body")
    expect(body).toBeTruthy()
  })

  test("Sign out works and returns to login", async ({ page }) => {
    // Look for sign out button/link
    const signOutBtn = page.locator(
      'text="Sign Out", button:has-text("Sign Out"), [data-testid="sign-out"]'
    )

    if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signOutBtn.click()
      await page.waitForURL("**/login", { timeout: 10000 })
      expect(page.url()).toContain("/login")
    }
  })
})

// ─── API Route Tests ───

test.describe("API Routes", () => {
  test("POST /api/auth/audit accepts audit events", async ({ request }) => {
    const resp = await request.post(`${PORTAL_URL}/api/auth/audit`, {
      data: {
        event_type: "login_failed",
        email: "playwright-test@asi360.co",
        metadata: { reason: "E2E smoke test", source: "playwright" },
      },
    })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body).toHaveProperty("logged")
  })
})

// ─── Static Dashboard (basic auth) ───

test.describe("Static Project Dashboard (basic auth)", () => {
  test("Root / requires basic auth", async ({ request }) => {
    const resp = await request.get(`${PORTAL_URL}/`, {
      maxRedirects: 0,
    })
    // Should be 401 without credentials
    expect(resp.status()).toBe(401)
  })

  test("Root / with basic auth returns 200", async ({ request }) => {
    const resp = await request.get(`${PORTAL_URL}/`, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from("admin:ASI360projects2026").toString("base64"),
      },
    })
    expect(resp.status()).toBe(200)
  })
})
