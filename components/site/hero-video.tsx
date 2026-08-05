'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// The hero clip carries no poster on purpose. A poster is a still photograph
// that gets replaced by the first video frame, and any mismatch between the
// two reads as a flash on load. Instead the frame sits on the kraft panel
// behind it until the video itself has a frame to show, then fades in.
export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [ready, setReady] = useState(false)

  // The media can reach HAVE_CURRENT_DATA before hydration attaches the
  // event handlers below, so check the state we may have already missed.
  useEffect(() => {
    if (ref.current && ref.current.readyState >= 2) setReady(true)
  }, [])

  const markReady = () => setReady(true)

  return (
    <video
      ref={ref}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onLoadedData={markReady}
      onCanPlay={markReady}
      onPlaying={markReady}
      aria-label="Дете рисува върху картонена къщичка за игра Wondercraft"
      className={cn(
        'h-full w-full object-cover transition-opacity duration-500',
        ready ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <source src="/videos/kid-draws-on-house.mp4" type="video/mp4" />
    </video>
  )
}
