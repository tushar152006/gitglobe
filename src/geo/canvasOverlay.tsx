import { useEffect, useRef } from 'react'

export interface CanvasOverlayHit<T> {
  payload: T
  cursor?: string
}

interface CanvasOverlayProps<T> {
  className: string
  width: number
  height: number
  visible: boolean
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  hitTest?: (clientX: number, clientY: number) => CanvasOverlayHit<T> | null
  onHit?: (payload: T) => void
}

export function CanvasOverlay<T>({
  className,
  width,
  height,
  visible,
  draw,
  hitTest,
  onHit,
}: CanvasOverlayProps<T>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !visible) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height)
  }, [draw, height, visible, width])

  useEffect(() => {
    if (!visible || !hitTest || !onHit) return
    const safeHitTest = hitTest
    const safeOnHit = onHit

    function handleMove(event: MouseEvent) {
      const hit = safeHitTest(event.clientX, event.clientY)
      document.body.style.cursor = hit?.cursor ?? ''
    }

    function handleClick(event: MouseEvent) {
      const hit = safeHitTest(event.clientX, event.clientY)
      if (hit) safeOnHit(hit.payload)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('click', handleClick)
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('click', handleClick)
    }
  }, [hitTest, onHit, visible])

  if (!visible) return null

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
