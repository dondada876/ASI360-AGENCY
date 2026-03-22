'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// ── Tour Script Types ──

export interface TourWaypoint {
  time: number          // ms from tour start
  action: 'animate_camera' | 'play_audio' | 'show_hotspot' | 'show_menu' | 'check_video_buffer' | 'crossfade_to_video' | 'pause'
  yaw?: number          // degrees
  pitch?: number        // degrees
  zoom?: number
  label?: string        // human-readable description
  asset?: string        // audio URL or hotspot ID
  duration?: number     // for pause action (ms)
  speed?: string        // rotation speed (e.g., '2rpm')
}

export interface TourScript {
  zoneId: string
  name: string
  welcomeAudioUrl?: string
  waypoints: TourWaypoint[]
}

// ── Pre-calibrated Tour: Cabana/Tents Zone A1 ──
// Coordinates captured via sphere calibration tool on 2026-03-22

export const TOUR_CABANA_TENTS: TourScript = {
  zoneId: 'A1',
  name: 'Cabana Experience Tour',
  welcomeAudioUrl: '/audio/welcome.mp3',
  waypoints: [
    {
      time: 0,
      action: 'animate_camera',
      yaw: 212.4,
      pitch: -3,
      zoom: 40,
      label: 'Cabana couch - welcome starting view',
      speed: '2rpm',
    },
    {
      time: 500,
      action: 'play_audio',
      asset: '/audio/welcome.mp3',
      label: 'Welcome narration begins',
    },
    {
      time: 3000,
      action: 'animate_camera',
      yaw: 250.9,
      pitch: -4.1,
      zoom: 40,
      label: 'Cornhole and games area - left of couch',
      speed: '2rpm',
    },
    {
      time: 6000,
      action: 'animate_camera',
      yaw: 300,
      pitch: 0,
      zoom: 40,
      label: 'Wide view - umbrellas and lake appearing',
      speed: '2rpm',
    },
    {
      time: 9000,
      action: 'animate_camera',
      yaw: 350,
      pitch: 2,
      zoom: 40,
      label: 'Premium umbrella spots along waterfront',
      speed: '2rpm',
    },
    {
      time: 12000,
      action: 'animate_camera',
      yaw: 30,
      pitch: 5,
      zoom: 40,
      label: 'Lake Merritt view - ambient pause moment',
      speed: '1.5rpm',
    },
    {
      time: 15000,
      action: 'animate_camera',
      yaw: 60,
      pitch: 8,
      zoom: 40,
      label: 'Serene lake view - birds water breeze',
      speed: '1rpm',
    },
    {
      time: 15000,
      action: 'pause',
      duration: 10000,
      label: '10 second ambient pause - just sounds',
    },
    {
      time: 25000,
      action: 'check_video_buffer',
      label: 'Check if video is 50%+ buffered',
    },
    {
      time: 27000,
      action: 'crossfade_to_video',
      label: 'Seamless crossfade to live video preview',
    },
  ],
}

// ── Pre-calibrated Tour: Walkway Zone A1 ──

export const TOUR_WALKWAY: TourScript = {
  zoneId: 'A1',
  name: 'Walkway Tour',
  welcomeAudioUrl: '/audio/book-umbrella.mp3',
  waypoints: [
    {
      time: 0,
      action: 'animate_camera',
      yaw: 135,
      pitch: -3,
      zoom: 40,
      label: 'Walkway starting view - path and tree',
      speed: '2rpm',
    },
    {
      time: 500,
      action: 'play_audio',
      asset: '/audio/book-umbrella.mp3',
      label: 'Umbrella booking narration',
    },
    {
      time: 4000,
      action: 'animate_camera',
      yaw: 60,
      pitch: 0,
      zoom: 40,
      label: 'Pan right to lake and umbrellas',
      speed: '2rpm',
    },
    {
      time: 8000,
      action: 'animate_camera',
      yaw: 350,
      pitch: 5,
      zoom: 40,
      label: 'Continue to full lake panorama',
      speed: '1.5rpm',
    },
    {
      time: 12000,
      action: 'pause',
      duration: 8000,
      label: 'Ambient pause - lake sounds',
    },
    {
      time: 20000,
      action: 'check_video_buffer',
      label: 'Check video buffer',
    },
    {
      time: 22000,
      action: 'crossfade_to_video',
      label: 'Crossfade to live preview',
    },
  ],
}

// ── Tour Registry ──
// Map sphere URLs to their tour scripts
// Future: load from Supabase booking_zone_tours table

const TOUR_REGISTRY: Record<string, TourScript> = {
  '/360/spheres/zone-a2-tents-sphere-5s.jpg': TOUR_CABANA_TENTS,
  '/360/spheres/zone-a2-sphere-3s.jpg': TOUR_WALKWAY,
}

export function getTourForSphere(sphereUrl: string): TourScript | null {
  return TOUR_REGISTRY[sphereUrl] || null
}

// ── Hook: useGuidedTour ──

interface UseGuidedTourOptions {
  viewer: any                          // Photo Sphere Viewer instance
  sphereUrl?: string                   // To look up tour script
  tourScript?: TourScript              // Or provide directly
  onPlayAudio?: (url: string) => void  // Callback to play audio
  onShowMenu?: (height: string) => void // Callback to show booking menu
  onCrossfadeToVideo?: () => void      // Callback to switch to video
  onVideoBufferCheck?: () => boolean   // Returns true if video is ready
  enabled?: boolean                    // Disable for return visitors
}

interface UseGuidedTourReturn {
  isPlaying: boolean
  currentWaypoint: number
  totalWaypoints: number
  progress: number           // 0-100
  play: () => void
  pause: () => void
  stop: () => void
  skip: () => void           // Jump to end (show menu immediately)
}

export function useGuidedTour({
  viewer,
  sphereUrl,
  tourScript: providedScript,
  onPlayAudio,
  onShowMenu,
  onCrossfadeToVideo,
  onVideoBufferCheck,
  enabled = true,
}: UseGuidedTourOptions): UseGuidedTourReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentWaypoint, setCurrentWaypoint] = useState(0)
  const timersRef = useRef<NodeJS.Timeout[]>([])
  const startTimeRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)

  // Resolve tour script
  const script = providedScript || (sphereUrl ? getTourForSphere(sphereUrl) : null)
  const totalWaypoints = script?.waypoints.length || 0

  // Check if return visitor (skip tour)
  const isReturnVisitor = useCallback(() => {
    if (typeof window === 'undefined') return false
    const key = `visited_tour_${script?.zoneId || 'unknown'}`
    return localStorage.getItem(key) === 'true'
  }, [script?.zoneId])

  // Mark as visited
  const markVisited = useCallback(() => {
    if (typeof window === 'undefined' || !script?.zoneId) return
    localStorage.setItem(`visited_tour_${script.zoneId}`, 'true')
  }, [script?.zoneId])

  // Execute a single waypoint action
  const executeWaypoint = useCallback((waypoint: TourWaypoint, index: number) => {
    if (!viewer) return

    setCurrentWaypoint(index)

    switch (waypoint.action) {
      case 'animate_camera':
        if (waypoint.yaw !== undefined && waypoint.pitch !== undefined) {
          viewer.animate({
            yaw: (waypoint.yaw * Math.PI) / 180,
            pitch: (waypoint.pitch * Math.PI) / 180,
            zoom: waypoint.zoom,
            speed: waypoint.speed || '2rpm',
          }).catch(() => {
            // Animation interrupted by user interaction — that's OK
          })
        }
        break

      case 'play_audio':
        if (waypoint.asset && onPlayAudio) {
          onPlayAudio(waypoint.asset)
        }
        break

      case 'show_menu':
        if (onShowMenu) {
          onShowMenu('25%')
        }
        break

      case 'check_video_buffer':
        if (onVideoBufferCheck) {
          const ready = onVideoBufferCheck()
          if (ready && onCrossfadeToVideo) {
            // Video ready early — crossfade now
            onCrossfadeToVideo()
          }
        }
        break

      case 'crossfade_to_video':
        if (onCrossfadeToVideo) {
          onCrossfadeToVideo()
        }
        break

      case 'pause':
        // Just wait — the next waypoint timer handles resuming
        break
    }
  }, [viewer, onPlayAudio, onShowMenu, onCrossfadeToVideo, onVideoBufferCheck])

  // Play the tour
  const play = useCallback(() => {
    if (!script || !viewer || !enabled) return

    // Return visitors get a short greeting, not the full tour
    if (isReturnVisitor()) {
      // Just show the menu after a brief pause
      setTimeout(() => {
        if (onShowMenu) onShowMenu('25%')
      }, 1500)
      return
    }

    setIsPlaying(true)
    startTimeRef.current = Date.now()

    // Schedule all waypoints
    const timers: NodeJS.Timeout[] = []
    script.waypoints.forEach((wp, i) => {
      const timer = setTimeout(() => {
        executeWaypoint(wp, i)
      }, wp.time)
      timers.push(timer)
    })

    // Mark tour complete after last waypoint
    const lastTime = script.waypoints[script.waypoints.length - 1]?.time || 0
    const endTimer = setTimeout(() => {
      setIsPlaying(false)
      markVisited()
    }, lastTime + 5000)
    timers.push(endTimer)

    timersRef.current = timers
  }, [script, viewer, enabled, isReturnVisitor, executeWaypoint, onShowMenu, markVisited])

  // Pause the tour
  const pause = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    pausedAtRef.current = Date.now() - startTimeRef.current
    setIsPlaying(false)
  }, [])

  // Stop the tour completely
  const stop = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setIsPlaying(false)
    setCurrentWaypoint(0)
    pausedAtRef.current = 0
  }, [])

  // Skip to end — show menu immediately
  const skip = useCallback(() => {
    stop()
    if (onShowMenu) onShowMenu('25%')
    markVisited()
  }, [stop, onShowMenu, markVisited])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [])

  // Auto-pause when user interacts with the sphere
  useEffect(() => {
    if (!viewer || !isPlaying) return

    const handleUserInteraction = () => {
      if (isPlaying) {
        pause()
        // Resume after 3 seconds of inactivity
        const resumeTimer = setTimeout(() => {
          // Don't auto-resume — let user explore
        }, 3000)
        return () => clearTimeout(resumeTimer)
      }
    }

    viewer.addEventListener('position-updated', handleUserInteraction)
    return () => {
      try {
        viewer.removeEventListener('position-updated', handleUserInteraction)
      } catch {}
    }
  }, [viewer, isPlaying, pause])

  // Calculate progress
  const lastTime = script?.waypoints[script.waypoints.length - 1]?.time || 1
  const elapsed = isPlaying ? Date.now() - startTimeRef.current : pausedAtRef.current
  const progress = Math.min(100, Math.round((elapsed / (lastTime + 5000)) * 100))

  return {
    isPlaying,
    currentWaypoint,
    totalWaypoints,
    progress,
    play,
    pause,
    stop,
    skip,
  }
}
