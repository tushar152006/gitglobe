import { useEffect, useState } from 'react'

function readViewport() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 }
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

export function useViewportSize() {
  const [viewport, setViewport] = useState(readViewport)

  useEffect(() => {
    function handleResize() {
      setViewport(readViewport())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return viewport
}
