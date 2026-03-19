// 500 Grand Live — Modular Intro System
// Cinematic globe-to-lakeside camera sequences for first-time visitors

export type IntroSequence = 'globe-full' | 'fly-orbit' | 'orbit-only' | 'instant' | 'qr-direct'

export const INTRO_FLOWS: Record<IntroSequence, string[]> = {
  'globe-full':  ['globe', 'descent', 'orbit', 'dive360'],
  'fly-orbit':   ['descent', 'orbit'],
  'orbit-only':  ['orbit'],
  'instant':     [],
  'qr-direct':   ['zoomToPole'],
}

export function getVisitCount(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem('500gl_visit_count') || '0', 10)
}

export function incrementVisitCount(): void {
  if (typeof window === 'undefined') return
  const count = getVisitCount() + 1
  localStorage.setItem('500gl_visit_count', String(count))
}

export function getIntroSequence(): IntroSequence {
  const visits = getVisitCount()
  if (visits === 0) return 'globe-full'
  if (visits <= 5) return 'fly-orbit'
  return 'instant'
}

// Each animation step as a function that takes map and returns a Promise
export function runGlobe(map: any): Promise<void> {
  return new Promise((resolve) => {
    // Start at globe view with atmosphere
    map.setProjection('globe')
    map.setFog({
      color: 'rgb(186, 210, 235)',
      'high-color': 'rgb(36, 92, 223)',
      'horizon-blend': 0.02,
      'space-color': 'rgb(11, 11, 25)',
      'star-intensity': 0.6,
    })
    map.jumpTo({ center: [30, 15], zoom: 1.5, pitch: 0, bearing: 0 })

    // Spin globe slowly for 2.5 seconds
    let bearing = 0
    const spin = () => {
      bearing += 0.8
      map.setBearing(bearing % 360)
    }
    const interval = setInterval(spin, 16)
    setTimeout(() => {
      clearInterval(interval)
      resolve()
    }, 2500)
  })
}

export function runDescent(map: any): Promise<void> {
  return new Promise((resolve) => {
    // Remove globe projection for the descent
    map.setProjection('mercator')
    map.setFog({})

    map.flyTo({
      center: [-122.2509, 37.8073],
      zoom: 17.5,
      pitch: 50,
      bearing: -30,
      duration: 3500,
      essential: true,
      curve: 1.8,
    })
    map.once('moveend', () => resolve())
  })
}

export function runOrbit(map: any): Promise<void> {
  return new Promise((resolve) => {
    // Do a partial orbit (~120 degrees) over 5 seconds
    const startBearing = map.getBearing()
    const targetBearing = startBearing + 120
    const duration = 5000
    const start = performance.now()

    const animate = (time: number) => {
      const elapsed = time - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

      map.setBearing(startBearing + (targetBearing - startBearing) * eased)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(animate)
  })
}

export async function runIntro(map: any, sequence: IntroSequence, onDive360?: () => void): Promise<void> {
  const steps = INTRO_FLOWS[sequence]

  for (const step of steps) {
    switch (step) {
      case 'globe':
        await runGlobe(map)
        break
      case 'descent':
        await runDescent(map)
        break
      case 'orbit':
        await runOrbit(map)
        break
      case 'dive360':
        // Fly toward A1 zone, then trigger 360° modal
        map.flyTo({
          center: [-122.25150, 37.80835],
          zoom: 19,
          pitch: 65,
          bearing: -10,
          duration: 2000,
        })
        await new Promise(r => setTimeout(r, 2200))
        onDive360?.()
        break
    }
  }
}
