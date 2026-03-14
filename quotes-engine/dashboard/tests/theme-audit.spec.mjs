/**
 * Playwright Theme & Color Audit — identifies white-out / broken color issues
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const BASE = 'http://localhost:3210'
const results = { screenshots: [], findings: [], errors: [] }

async function run() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark', // System dark mode
  })

  // Collect console errors
  const page = await context.newPage()
  page.on('console', msg => {
    if (msg.type() === 'error') results.errors.push(msg.text())
  })
  page.on('pageerror', err => results.errors.push(err.message))

  // ─── Test 1: Project List (dark mode default) ───
  console.log('Test 1: Loading project list (dark mode)...')
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'tests/screenshots/01-project-list-dark.png', fullPage: true })
  results.screenshots.push('01-project-list-dark.png')

  // Check if the HTML element has 'dark' class
  const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  results.findings.push({ test: 'HTML dark class present', value: hasDarkClass, expected: true, pass: hasDarkClass })

  // ─── Test 2: CSS Variable Resolution ───
  console.log('Test 2: Auditing CSS custom properties...')
  const cssVarAudit = await page.evaluate(() => {
    const root = document.documentElement
    const style = getComputedStyle(root)
    const vars = [
      '--bg-primary', '--bg-secondary', '--bg-card', '--bg-card-hover',
      '--text-primary', '--text-secondary', '--text-muted',
      '--border-primary', '--border-secondary',
      '--phase-1', '--phase-2', '--phase-3', '--phase-4', '--phase-5',
      '--gantt-today-bg', '--gantt-today-line',
      '--tooltip-bg', '--modal-bg', '--modal-header-bg',
      '--progress-track', '--scrollbar-thumb',
    ]
    const audit = {}
    for (const v of vars) {
      const val = style.getPropertyValue(v).trim()
      audit[v] = val || '(EMPTY)'
    }
    return audit
  })

  // Check for empty or unexpected values
  for (const [varName, value] of Object.entries(cssVarAudit)) {
    const isEmpty = value === '(EMPTY)' || value === ''
    const isWhiteOnDark = varName.startsWith('--bg-') && value === '#ffffff' && hasDarkClass
    results.findings.push({
      test: `CSS var ${varName}`,
      value,
      pass: !isEmpty && !isWhiteOnDark,
      issue: isEmpty ? 'EMPTY - not resolving!' : isWhiteOnDark ? 'White bg in dark mode!' : null,
    })
  }

  // ─── Test 3: Check actual computed backgrounds of key elements ───
  console.log('Test 3: Checking computed element backgrounds...')
  const elementAudit = await page.evaluate(() => {
    const checks = []

    // Body / root background
    const body = document.body
    const bodyBg = getComputedStyle(body).backgroundColor
    checks.push({ el: 'body', prop: 'backgroundColor', value: bodyBg })

    // Root div
    const rootDiv = document.getElementById('root')
    if (rootDiv?.firstElementChild) {
      const rootBg = getComputedStyle(rootDiv.firstElementChild).backgroundColor
      checks.push({ el: '#root > first-child', prop: 'backgroundColor', value: rootBg })
    }

    // Header
    const header = document.querySelector('header')
    if (header) {
      const headerBg = getComputedStyle(header).backgroundColor
      const headerColor = getComputedStyle(header).color
      checks.push({ el: 'header', prop: 'backgroundColor', value: headerBg })
      checks.push({ el: 'header', prop: 'color', value: headerColor })
    }

    // Check all elements with style="backgroundColor: var(--bg-*)"
    const allElsWithBg = document.querySelectorAll('[style*="background"]')
    let whiteCount = 0
    let totalChecked = 0
    for (const el of allElsWithBg) {
      totalChecked++
      const bg = getComputedStyle(el).backgroundColor
      if (bg === 'rgb(255, 255, 255)' || bg === 'rgba(0, 0, 0, 0)') {
        whiteCount++
      }
    }
    checks.push({ el: `Elements with bg styles (${totalChecked} total)`, prop: 'white/transparent count', value: whiteCount })

    // Check if any text is invisible (white on white)
    const allText = document.querySelectorAll('h1, h2, h3, p, span, a, button, td, th, li, div')
    let invisibleCount = 0
    for (const el of allText) {
      const style = getComputedStyle(el)
      const bg = style.backgroundColor
      const color = style.color
      // Both white = invisible
      if ((bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)') &&
          (color === 'rgb(255, 255, 255)' || color === 'rgba(255, 255, 255, 1)')) {
        invisibleCount++
        if (invisibleCount <= 5) {
          checks.push({ el: el.tagName + '.' + el.className.split(' ')[0], prop: 'INVISIBLE (white on white)', value: `bg=${bg}, color=${color}` })
        }
      }
    }
    checks.push({ el: 'ALL TEXT ELEMENTS', prop: 'invisible (white-on-white) count', value: invisibleCount })

    return checks
  })

  for (const check of elementAudit) {
    results.findings.push({
      test: `Element: ${check.el} → ${check.prop}`,
      value: check.value,
      pass: true, // informational
    })
  }

  // ─── Test 4: Check if Tailwind CSS is loaded and generating classes ───
  console.log('Test 4: Checking Tailwind CSS...')
  const tailwindCheck = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets)
    const ruleCount = sheets.reduce((sum, s) => {
      try { return sum + s.cssRules.length } catch { return sum }
    }, 0)

    // Check if specific custom properties are in any stylesheet
    let foundDarkSelector = false
    let foundRootVars = false
    for (const sheet of sheets) {
      try {
        for (const rule of sheet.cssRules) {
          const text = rule.cssText || ''
          if (text.includes('.dark')) foundDarkSelector = true
          if (text.includes('--bg-primary')) foundRootVars = true
        }
      } catch {}
    }

    return { sheetCount: sheets.length, totalRules: ruleCount, foundDarkSelector, foundRootVars }
  })

  results.findings.push({ test: 'Stylesheet count', value: tailwindCheck.sheetCount, pass: tailwindCheck.sheetCount > 0 })
  results.findings.push({ test: 'Total CSS rules', value: tailwindCheck.totalRules, pass: tailwindCheck.totalRules > 50 })
  results.findings.push({ test: '.dark selector found in CSS', value: tailwindCheck.foundDarkSelector, expected: true, pass: tailwindCheck.foundDarkSelector })
  results.findings.push({ test: '--bg-primary found in CSS', value: tailwindCheck.foundRootVars, expected: true, pass: tailwindCheck.foundRootVars })

  // ─── Test 5: Light mode toggle test ───
  console.log('Test 5: Testing light mode...')
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark')
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tests/screenshots/02-project-list-light.png', fullPage: true })
  results.screenshots.push('02-project-list-light.png')

  const lightModeVars = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      bgPrimary: style.getPropertyValue('--bg-primary').trim(),
      textPrimary: style.getPropertyValue('--text-primary').trim(),
      bgCard: style.getPropertyValue('--bg-card').trim(),
    }
  })
  results.findings.push({ test: 'Light mode --bg-primary', value: lightModeVars.bgPrimary, expected: '#f1f5f9', pass: lightModeVars.bgPrimary === '#f1f5f9' })
  results.findings.push({ test: 'Light mode --text-primary', value: lightModeVars.textPrimary, expected: '#0f172a', pass: lightModeVars.textPrimary === '#0f172a' })
  results.findings.push({ test: 'Light mode --bg-card', value: lightModeVars.bgCard, expected: '#ffffff', pass: lightModeVars.bgCard === '#ffffff' })
  results.findings.push({ test: 'Light mode bg-primary ≠ bg-card (visual hierarchy)', value: lightModeVars.bgPrimary !== lightModeVars.bgCard, expected: true, pass: lightModeVars.bgPrimary !== lightModeVars.bgCard })

  // ─── Test 6: Switch back to dark and verify ───
  console.log('Test 6: Dark mode restored...')
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
  })
  await page.waitForTimeout(500)

  const darkModeVars = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return {
      bgPrimary: style.getPropertyValue('--bg-primary').trim(),
      textPrimary: style.getPropertyValue('--text-primary').trim(),
      bgCard: style.getPropertyValue('--bg-card').trim(),
    }
  })
  results.findings.push({ test: 'Dark mode --bg-primary', value: darkModeVars.bgPrimary, expected: '#030712', pass: darkModeVars.bgPrimary === '#030712' })
  results.findings.push({ test: 'Dark mode --text-primary', value: darkModeVars.textPrimary, expected: '#ffffff', pass: darkModeVars.textPrimary === '#ffffff' })
  results.findings.push({ test: 'Dark mode --bg-card', value: darkModeVars.bgCard, expected: '#111827', pass: darkModeVars.bgCard === '#111827' })

  // ─── Test 7: Production build test ───
  console.log('Test 7: Checking production build CSS...')
  const prodPage = await context.newPage()
  // Serve from dist if available
  try {
    // Just check the built CSS file for the .dark selector
    const { readFileSync, existsSync, readdirSync } = await import('fs')
    const assetsDir = 'dist/assets'
    if (existsSync(assetsDir)) {
      const cssFiles = readdirSync(assetsDir).filter(f => f.endsWith('.css'))
      for (const f of cssFiles) {
        const css = readFileSync(`${assetsDir}/${f}`, 'utf-8')
        const hasDarkInProd = css.includes('.dark')
        const hasRootVarsInProd = css.includes('--bg-primary')
        const hasBgPrimaryWhite = css.includes('--bg-primary:#fff') || css.includes('--bg-primary: #fff')
        const hasBgPrimaryDark = css.includes('--bg-primary:#030712') || css.includes('--bg-primary: #030712')
        results.findings.push({ test: `Production CSS (${f}): .dark selector`, value: hasDarkInProd, pass: hasDarkInProd })
        results.findings.push({ test: `Production CSS (${f}): --bg-primary defined`, value: hasRootVarsInProd, pass: hasRootVarsInProd })
        results.findings.push({ test: `Production CSS (${f}): light bg-primary (#fff)`, value: hasBgPrimaryWhite, pass: true })
        results.findings.push({ test: `Production CSS (${f}): dark bg-primary (#030712)`, value: hasBgPrimaryDark, pass: true })

        // Check for potential CSS specificity issues
        // Tailwind v4 uses @layer — check if our vars are inside a layer
        const hasLayer = css.includes('@layer')
        results.findings.push({ test: `Production CSS: uses @layer`, value: hasLayer, pass: true })

        // Check the order - are .dark vars after :root vars?
        const rootIdx = css.indexOf(':root')
        const darkIdx = css.indexOf('.dark')
        results.findings.push({ test: `Production CSS: :root index`, value: rootIdx, pass: rootIdx >= 0 })
        results.findings.push({ test: `Production CSS: .dark index`, value: darkIdx, pass: darkIdx > rootIdx })
      }
    } else {
      results.findings.push({ test: 'Production dist/assets', value: 'NOT FOUND', pass: false })
    }
  } catch (e) {
    results.errors.push(`Prod CSS check: ${e.message}`)
  }

  await browser.close()

  // ─── Report ───
  console.log('\n' + '═'.repeat(70))
  console.log(' THEME AUDIT REPORT')
  console.log('═'.repeat(70))

  const failures = results.findings.filter(f => f.pass === false)
  const passes = results.findings.filter(f => f.pass === true)

  console.log(`\n✅ PASSES: ${passes.length}`)
  console.log(`❌ FAILURES: ${failures.length}`)
  console.log(`📸 Screenshots: ${results.screenshots.length}`)
  console.log(`🔥 Console errors: ${results.errors.length}`)

  if (failures.length > 0) {
    console.log('\n── FAILURES ──')
    for (const f of failures) {
      console.log(`  ❌ ${f.test}: got "${f.value}"${f.expected ? ` (expected: "${f.expected}")` : ''}${f.issue ? ` — ${f.issue}` : ''}`)
    }
  }

  console.log('\n── ALL FINDINGS ──')
  for (const f of results.findings) {
    const icon = f.pass === false ? '❌' : f.pass === true ? '✅' : 'ℹ️'
    console.log(`  ${icon} ${f.test}: ${JSON.stringify(f.value)}${f.issue ? ` — ${f.issue}` : ''}`)
  }

  if (results.errors.length > 0) {
    console.log('\n── CONSOLE ERRORS ──')
    for (const e of results.errors) {
      console.log(`  🔥 ${e}`)
    }
  }

  // Write JSON report
  writeFileSync('tests/theme-audit-report.json', JSON.stringify(results, null, 2))
  console.log('\nFull report written to tests/theme-audit-report.json')
  console.log('Screenshots in tests/screenshots/')
}

run().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
