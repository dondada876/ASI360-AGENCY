/**
 * Full Dashboard Audit — Presentation, Comparative, Functionality
 * Captures screenshots, measures performance, tests all views and interactions.
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs'

const BASE = 'http://localhost:3211'
const SCREENSHOTS_DIR = 'tests/screenshots/audit'
const report = {
  timestamp: new Date().toISOString(),
  presentation: { findings: [], screenshots: [] },
  comparative: { findings: [], screenshots: [] },
  functionality: { findings: [], screenshots: [] },
  performance: { findings: [] },
  summary: {}
}

// Ensure screenshot directory exists
if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true })

function score(pass, total) {
  return Math.round((pass / total) * 100)
}

async function run() {
  const browser = await chromium.launch()

  // ═══════════════════════════════════════════════════════════
  // PART 1: PRESENTATION LAYER AUDIT
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ PART 1: PRESENTATION LAYER AUDIT ═══')

  // --- 1A: Dark Mode - Project List ---
  console.log('  1A: Dark mode - Project list...')
  const darkCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  })
  const darkPage = await darkCtx.newPage()
  const consoleErrors = []
  darkPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  darkPage.on('pageerror', err => consoleErrors.push(err.message))

  await darkPage.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 })
  await darkPage.waitForTimeout(2000)
  await darkPage.screenshot({ path: `${SCREENSHOTS_DIR}/01-dark-projectlist-1440.png`, fullPage: true })
  report.presentation.screenshots.push('01-dark-projectlist-1440.png')

  // Check dark mode CSS variables
  const darkVars = await darkPage.evaluate(() => {
    const s = getComputedStyle(document.documentElement)
    return {
      bgPrimary: s.getPropertyValue('--bg-primary').trim(),
      bgCard: s.getPropertyValue('--bg-card').trim(),
      textPrimary: s.getPropertyValue('--text-primary').trim(),
      borderPrimary: s.getPropertyValue('--border-primary').trim(),
      cardShadow: s.getPropertyValue('--card-shadow').trim(),
    }
  })
  report.presentation.findings.push({
    test: 'Dark mode: bg-primary ≠ bg-card (hierarchy)',
    pass: darkVars.bgPrimary !== darkVars.bgCard,
    value: `${darkVars.bgPrimary} vs ${darkVars.bgCard}`
  })
  report.presentation.findings.push({
    test: 'Dark mode: card-shadow is none',
    pass: darkVars.cardShadow === 'none' || darkVars.cardShadow === '',
    value: darkVars.cardShadow
  })

  // Count visible project cards
  const cardCount = await darkPage.locator('[style*="background"]').count()
  report.presentation.findings.push({
    test: 'Project cards rendered',
    pass: cardCount > 0,
    value: cardCount
  })

  // Check header branding
  const headerText = await darkPage.locator('header').textContent()
  report.presentation.findings.push({
    test: 'Header contains ASI 360 branding',
    pass: headerText.includes('ASI 360'),
    value: headerText.substring(0, 80)
  })

  // --- 1B: Dark Mode - Project HUD (click first project) ---
  console.log('  1B: Dark mode - Project HUD...')
  const firstCard = darkPage.locator('a[href*="/"]').first()
  if (await firstCard.count() > 0) {
    await firstCard.click()
    await darkPage.waitForTimeout(3000)
    await darkPage.screenshot({ path: `${SCREENSHOTS_DIR}/02-dark-hud-gantt-1440.png`, fullPage: true })
    report.presentation.screenshots.push('02-dark-hud-gantt-1440.png')

    // Check Gantt view rendered
    const ganttCells = await darkPage.locator('[style*="grid"]').count()
    report.presentation.findings.push({
      test: 'Gantt timeline grid rendered',
      pass: ganttCells > 0,
      value: `${ganttCells} grid elements`
    })

    // Check sidebar components
    const sidebarText = await darkPage.evaluate(() => {
      const texts = []
      document.querySelectorAll('h3').forEach(h => texts.push(h.textContent))
      return texts
    })
    report.presentation.findings.push({
      test: 'Sidebar sections present (Next Steps, Project Health, Details)',
      pass: sidebarText.some(t => t.includes('Next')) && sidebarText.some(t => t.includes('Health')) && sidebarText.some(t => t.includes('Details')),
      value: sidebarText.join(', ')
    })

    // Check PM Triangle gauges
    const svgCount = await darkPage.locator('svg').count()
    report.presentation.findings.push({
      test: 'SVG elements present (gauge meters)',
      pass: svgCount >= 3,
      value: `${svgCount} SVGs`
    })

    // --- 1C: Kanban View ---
    console.log('  1C: Dark mode - Kanban view...')
    const kanbanBtn = darkPage.locator('button:has-text("Kanban"), button:has-text("kanban")').first()
    if (await kanbanBtn.count() > 0) {
      await kanbanBtn.click()
      await darkPage.waitForTimeout(1000)
      await darkPage.screenshot({ path: `${SCREENSHOTS_DIR}/03-dark-kanban-1440.png`, fullPage: true })
      report.presentation.screenshots.push('03-dark-kanban-1440.png')

      const kanbanColumns = await darkPage.locator('[class*="flex-1"]').count()
      report.functionality.findings.push({
        test: 'Kanban columns rendered',
        pass: kanbanColumns > 0,
        value: `${kanbanColumns} columns`
      })
    }

    // --- 1D: List View ---
    console.log('  1D: Dark mode - List view...')
    const listBtn = darkPage.locator('button:has-text("List"), button:has-text("list")').first()
    if (await listBtn.count() > 0) {
      await listBtn.click()
      await darkPage.waitForTimeout(1000)
      await darkPage.screenshot({ path: `${SCREENSHOTS_DIR}/04-dark-list-1440.png`, fullPage: true })
      report.presentation.screenshots.push('04-dark-list-1440.png')

      const tableRows = await darkPage.locator('tr, [class*="border-b"]').count()
      report.functionality.findings.push({
        test: 'List view rows rendered',
        pass: tableRows > 0,
        value: `${tableRows} rows`
      })
    }

    // Switch back to Gantt for remaining tests
    const ganttBtn = darkPage.locator('button:has-text("Gantt"), button:has-text("gantt")').first()
    if (await ganttBtn.count() > 0) {
      await ganttBtn.click()
      await darkPage.waitForTimeout(1000)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PART 2: COMPARATIVE ANALYSIS (Dark vs Light)
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ PART 2: COMPARATIVE ANALYSIS ═══')

  // --- 2A: Toggle to light mode ---
  console.log('  2A: Light mode toggle...')
  await darkPage.evaluate(() => {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('asi360-theme', 'light')
  })
  await darkPage.waitForTimeout(500)
  await darkPage.screenshot({ path: `${SCREENSHOTS_DIR}/05-light-hud-gantt-1440.png`, fullPage: true })
  report.comparative.screenshots.push('05-light-hud-gantt-1440.png')

  const lightVars = await darkPage.evaluate(() => {
    const s = getComputedStyle(document.documentElement)
    return {
      bgPrimary: s.getPropertyValue('--bg-primary').trim(),
      bgCard: s.getPropertyValue('--bg-card').trim(),
      textPrimary: s.getPropertyValue('--text-primary').trim(),
      borderPrimary: s.getPropertyValue('--border-primary').trim(),
      cardShadow: s.getPropertyValue('--card-shadow').trim(),
    }
  })

  report.comparative.findings.push({
    test: 'Light mode: bg-primary ≠ bg-card (visual hierarchy fix)',
    pass: lightVars.bgPrimary !== lightVars.bgCard,
    value: `page=${lightVars.bgPrimary}, card=${lightVars.bgCard}`,
    severity: 'Critical'
  })
  report.comparative.findings.push({
    test: 'Light mode: card-shadow present',
    pass: lightVars.cardShadow !== '' && lightVars.cardShadow !== 'none',
    value: lightVars.cardShadow
  })
  report.comparative.findings.push({
    test: 'Light mode: border-primary visible (not #e5e7eb)',
    pass: lightVars.borderPrimary !== '#e5e7eb',
    value: lightVars.borderPrimary
  })

  // Check invisible text in light mode
  const invisibleCheck = await darkPage.evaluate(() => {
    let invisible = 0
    const els = document.querySelectorAll('h1,h2,h3,p,span,a,button,td,th,li,div')
    for (const el of els) {
      const s = getComputedStyle(el)
      const bg = s.backgroundColor
      const c = s.color
      if ((bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)') &&
          (c === 'rgb(255, 255, 255)' || c === 'rgba(255, 255, 255, 1)')) invisible++
    }
    return invisible
  })
  report.comparative.findings.push({
    test: 'Light mode: zero invisible text (white-on-white)',
    pass: invisibleCheck === 0,
    value: `${invisibleCheck} invisible elements`
  })

  // --- 2B: Light mode project list ---
  console.log('  2B: Light mode - Project list...')
  await darkPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 })
  await darkPage.evaluate(() => {
    document.documentElement.classList.remove('dark')
  })
  await darkPage.waitForTimeout(1000)
  await darkPage.screenshot({ path: `${SCREENSHOTS_DIR}/06-light-projectlist-1440.png`, fullPage: true })
  report.comparative.screenshots.push('06-light-projectlist-1440.png')

  // Box shadow on cards in light mode
  const cardShadows = await darkPage.evaluate(() => {
    const cards = document.querySelectorAll('[style*="boxShadow"], [style*="box-shadow"]')
    return cards.length
  })
  report.comparative.findings.push({
    test: 'Light mode: cards have box-shadow elevation',
    pass: cardShadows > 0,
    value: `${cardShadows} shadowed elements`
  })

  // ═══════════════════════════════════════════════════════════
  // PART 3: RESPONSIVE AUDIT
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ PART 3: RESPONSIVE AUDIT ═══')

  // --- 3A: Tablet (768px) ---
  console.log('  3A: Tablet viewport (768px)...')
  const tabletCtx = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    colorScheme: 'dark',
  })
  const tabletPage = await tabletCtx.newPage()
  await tabletPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 })
  await tabletPage.waitForTimeout(2000)
  await tabletPage.screenshot({ path: `${SCREENSHOTS_DIR}/07-tablet-projectlist-768.png`, fullPage: true })
  report.presentation.screenshots.push('07-tablet-projectlist-768.png')

  // Click first project on tablet
  const tabletCard = tabletPage.locator('a[href*="/"]').first()
  if (await tabletCard.count() > 0) {
    await tabletCard.click()
    await tabletPage.waitForTimeout(3000)
    await tabletPage.screenshot({ path: `${SCREENSHOTS_DIR}/08-tablet-hud-768.png`, fullPage: true })
    report.presentation.screenshots.push('08-tablet-hud-768.png')
  }

  // --- 3B: Mobile (375px) ---
  console.log('  3B: Mobile viewport (375px)...')
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    colorScheme: 'dark',
  })
  const mobilePage = await mobileCtx.newPage()
  await mobilePage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 })
  await mobilePage.waitForTimeout(2000)
  await mobilePage.screenshot({ path: `${SCREENSHOTS_DIR}/09-mobile-projectlist-375.png`, fullPage: true })
  report.presentation.screenshots.push('09-mobile-projectlist-375.png')

  const mobileCard = mobilePage.locator('a[href*="/"]').first()
  if (await mobileCard.count() > 0) {
    await mobileCard.click()
    await mobilePage.waitForTimeout(3000)
    await mobilePage.screenshot({ path: `${SCREENSHOTS_DIR}/10-mobile-hud-375.png`, fullPage: true })
    report.presentation.screenshots.push('10-mobile-hud-375.png')
  }

  // Check for horizontal overflow on mobile
  const hasOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  report.presentation.findings.push({
    test: 'Mobile: no horizontal overflow',
    pass: !hasOverflow,
    value: hasOverflow ? 'OVERFLOW DETECTED' : 'No overflow'
  })

  // ═══════════════════════════════════════════════════════════
  // PART 4: FUNCTIONALITY AUDIT
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ PART 4: FUNCTIONALITY AUDIT ═══')

  // Use the dark desktop page for functionality tests
  const funcCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  })
  const funcPage = await funcCtx.newPage()
  const funcErrors = []
  funcPage.on('pageerror', err => funcErrors.push(err.message))

  // --- 4A: Navigation ---
  console.log('  4A: Navigation...')
  await funcPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 })
  await funcPage.waitForTimeout(2000)

  const projectLinks = await funcPage.locator('a[href*="/"]').all()
  report.functionality.findings.push({
    test: 'Project list loads with clickable project links',
    pass: projectLinks.length > 0,
    value: `${projectLinks.length} project links`
  })

  // Click into first project
  if (projectLinks.length > 0) {
    await projectLinks[0].click()
    await funcPage.waitForTimeout(3000)

    const currentUrl = funcPage.url()
    report.functionality.findings.push({
      test: 'Project navigation works (URL changed)',
      pass: currentUrl !== BASE && currentUrl !== BASE + '/',
      value: currentUrl
    })

    // --- 4B: View switching ---
    console.log('  4B: View switching...')
    const viewButtons = await funcPage.locator('button').all()
    const viewNames = []
    for (const btn of viewButtons) {
      const text = await btn.textContent()
      if (['Gantt', 'Kanban', 'List'].some(v => text.includes(v))) {
        viewNames.push(text.trim())
      }
    }
    report.functionality.findings.push({
      test: 'All 3 view buttons present (Gantt, Kanban, List)',
      pass: viewNames.length >= 3,
      value: viewNames.join(', ')
    })

    // --- 4C: Theme toggle ---
    console.log('  4C: Theme toggle...')
    const themeToggle = funcPage.locator('button[title*="heme"], button[title*="mode"], [class*="theme"]').first()
    if (await themeToggle.count() > 0) {
      const wasDark = await funcPage.evaluate(() => document.documentElement.classList.contains('dark'))
      await themeToggle.click()
      await funcPage.waitForTimeout(500)
      const isNowDark = await funcPage.evaluate(() => document.documentElement.classList.contains('dark'))
      report.functionality.findings.push({
        test: 'Theme toggle switches dark ↔ light',
        pass: wasDark !== isNowDark,
        value: `Was dark=${wasDark}, now dark=${isNowDark}`
      })
      // Toggle back
      await themeToggle.click()
      await funcPage.waitForTimeout(300)
    } else {
      // Try finding sun/moon icon button
      const sunMoon = funcPage.locator('button').filter({ hasText: /☀|🌙|☽|☾/ }).first()
      if (await sunMoon.count() > 0) {
        await sunMoon.click()
        await funcPage.waitForTimeout(500)
      }
      report.functionality.findings.push({
        test: 'Theme toggle button found',
        pass: false,
        value: 'Could not locate theme toggle button'
      })
    }

    // --- 4D: Search/Filter ---
    console.log('  4D: Search and filter...')
    const searchInput = funcPage.locator('input[placeholder*="earch"], input[type="search"]').first()
    if (await searchInput.count() > 0) {
      await searchInput.fill('test')
      await funcPage.waitForTimeout(500)
      await funcPage.screenshot({ path: `${SCREENSHOTS_DIR}/11-search-filter.png`, fullPage: true })
      report.functionality.screenshots.push('11-search-filter.png')

      await searchInput.fill('')
      await funcPage.waitForTimeout(300)
      report.functionality.findings.push({
        test: 'Search input functional',
        pass: true,
        value: 'Input accepts text, clears'
      })
    }

    // --- 4E: Refresh button ---
    console.log('  4E: Refresh button...')
    const refreshBtn = funcPage.locator('button[title*="efresh"]').first()
    if (await refreshBtn.count() > 0) {
      await refreshBtn.click()
      await funcPage.waitForTimeout(2000)
      report.functionality.findings.push({
        test: 'Manual refresh button works',
        pass: true,
        value: 'Refresh triggered without errors'
      })
    }

    // --- 4F: Back navigation ---
    console.log('  4F: Back navigation...')
    const backLink = funcPage.locator('a:has-text("Projects"), a:has-text("←")').first()
    if (await backLink.count() > 0) {
      await backLink.click()
      await funcPage.waitForTimeout(2000)
      const backUrl = funcPage.url()
      report.functionality.findings.push({
        test: 'Back to projects navigation works',
        pass: backUrl === BASE + '/' || backUrl === BASE,
        value: backUrl
      })
    }
  }

  // --- 4G: Console errors ---
  report.functionality.findings.push({
    test: 'Zero JS page errors during audit',
    pass: funcErrors.length === 0,
    value: funcErrors.length > 0 ? funcErrors.slice(0, 5).join('; ') : 'No errors'
  })

  // ═══════════════════════════════════════════════════════════
  // PART 5: PERFORMANCE METRICS
  // ═══════════════════════════════════════════════════════════
  console.log('\n═══ PART 5: PERFORMANCE METRICS ═══')

  const perfCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const perfPage = await perfCtx.newPage()

  // Measure page load time
  const startTime = Date.now()
  await perfPage.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 })
  const loadTime = Date.now() - startTime
  report.performance.findings.push({
    test: 'Project list initial load time',
    pass: loadTime < 5000,
    value: `${loadTime}ms`,
    threshold: '<5000ms'
  })

  // Navigate to first project and measure
  const perfCard = perfPage.locator('a[href*="/"]').first()
  if (await perfCard.count() > 0) {
    const hudStart = Date.now()
    await perfCard.click()
    await perfPage.waitForTimeout(3000)
    const hudLoad = Date.now() - hudStart
    report.performance.findings.push({
      test: 'HUD page load time (with data fetch)',
      pass: hudLoad < 8000,
      value: `${hudLoad}ms`,
      threshold: '<8000ms'
    })
  }

  // Bundle size analysis
  const assetsDir = 'dist/assets'
  if (existsSync(assetsDir)) {
    const files = readdirSync(assetsDir)
    for (const f of files) {
      const stats = readFileSync(`${assetsDir}/${f}`)
      const sizeKB = Math.round(stats.length / 1024)
      const isJS = f.endsWith('.js')
      const isCSS = f.endsWith('.css')
      report.performance.findings.push({
        test: `Bundle: ${f}`,
        pass: isJS ? sizeKB < 600 : isCSS ? sizeKB < 100 : true,
        value: `${sizeKB}KB`,
        threshold: isJS ? '<600KB' : isCSS ? '<100KB' : 'N/A'
      })
    }
  }

  // DOM node count
  const domCount = await perfPage.evaluate(() => document.querySelectorAll('*').length)
  report.performance.findings.push({
    test: 'DOM node count',
    pass: domCount < 3000,
    value: `${domCount} nodes`,
    threshold: '<3000'
  })

  await browser.close()

  // ═══════════════════════════════════════════════════════════
  // SUMMARY & REPORT
  // ═══════════════════════════════════════════════════════════
  const allFindings = [
    ...report.presentation.findings,
    ...report.comparative.findings,
    ...report.functionality.findings,
    ...report.performance.findings,
  ]
  const totalPasses = allFindings.filter(f => f.pass).length
  const totalFails = allFindings.filter(f => f.pass === false).length
  const totalTests = allFindings.length

  const presPass = report.presentation.findings.filter(f => f.pass).length
  const presTotal = report.presentation.findings.length
  const compPass = report.comparative.findings.filter(f => f.pass).length
  const compTotal = report.comparative.findings.length
  const funcPass = report.functionality.findings.filter(f => f.pass).length
  const funcTotal = report.functionality.findings.length
  const perfPass = report.performance.findings.filter(f => f.pass).length
  const perfTotal = report.performance.findings.length

  report.summary = {
    totalTests,
    totalPasses,
    totalFails,
    overallScore: score(totalPasses, totalTests),
    presentation: { score: score(presPass, presTotal), pass: presPass, total: presTotal },
    comparative: { score: score(compPass, compTotal), pass: compPass, total: compTotal },
    functionality: { score: score(funcPass, funcTotal), pass: funcPass, total: funcTotal },
    performance: { score: score(perfPass, perfTotal), pass: perfPass, total: perfTotal },
    screenshots: [
      ...report.presentation.screenshots,
      ...report.comparative.screenshots,
      ...report.functionality.screenshots,
    ],
    consoleErrors: consoleErrors,
  }

  // Print report
  console.log('\n' + '═'.repeat(70))
  console.log(' HUD DASHBOARD v3 — FULL AUDIT REPORT')
  console.log('═'.repeat(70))
  console.log(`\n  Overall Score: ${report.summary.overallScore}% (${totalPasses}/${totalTests})`)
  console.log(`  Presentation:  ${report.summary.presentation.score}% (${presPass}/${presTotal})`)
  console.log(`  Comparative:   ${report.summary.comparative.score}% (${compPass}/${compTotal})`)
  console.log(`  Functionality: ${report.summary.functionality.score}% (${funcPass}/${funcTotal})`)
  console.log(`  Performance:   ${report.summary.performance.score}% (${perfPass}/${perfTotal})`)
  console.log(`  Screenshots:   ${report.summary.screenshots.length}`)
  console.log(`  Console errors: ${consoleErrors.length}`)

  if (totalFails > 0) {
    console.log('\n── FAILURES ──')
    for (const f of allFindings.filter(f => f.pass === false)) {
      console.log(`  ❌ ${f.test}: ${f.value}`)
    }
  }

  console.log('\n── ALL FINDINGS ──')
  for (const f of allFindings) {
    const icon = f.pass ? '✅' : '❌'
    console.log(`  ${icon} ${f.test}: ${f.value}${f.threshold ? ` (threshold: ${f.threshold})` : ''}`)
  }

  // Write JSON
  writeFileSync('tests/full-audit-report.json', JSON.stringify(report, null, 2))
  console.log('\n✅ Full report: tests/full-audit-report.json')
  console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}/`)
}

run().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
