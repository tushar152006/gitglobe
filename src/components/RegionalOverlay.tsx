import { useCallback, useMemo } from 'react'
import { CanvasOverlay } from '../geo/canvasOverlay'
import { projectLngLat } from '../geo/projection'
import { useViewportSize } from '../hooks/useViewportSize'
import type { CountrySignal } from '../services/intelligence'

interface RegionalOverlayProps {
  signals: CountrySignal[]
  visible: boolean
  onSelectCountry?: (country: CountrySignal) => void
}

interface RenderNode {
  signal: CountrySignal
  x: number
  y: number
  size: number
}

export default function RegionalOverlay({ signals, visible, onSelectCountry }: RegionalOverlayProps) {
  const viewport = useViewportSize()

  const renderNodes = useMemo<RenderNode[]>(() => {
    const maxStars = Math.max(...signals.map((item) => item.totalStars), 1)
    return signals.slice(0, 18).map((signal) => {
      const [x, y] = projectLngLat(signal.coords, viewport)
      const size = 16 + (signal.totalStars / maxStars) * 52
      return { signal, x, y, size }
    })
  }, [signals, viewport])

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    renderNodes.forEach(({ x, y, size }) => {
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(82,210,255,0.08)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, size * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(82,210,255,0.16)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(x, y, size * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(130,232,255,0.95)'
      ctx.fill()
    })
  }, [renderNodes])

  const hitTest = useCallback((clientX: number, clientY: number) => {
    const signal = renderNodes.find(({ x: nodeX, y: nodeY, size }) => {
      const dx = clientX - nodeX
      const dy = clientY - nodeY
      return dx * dx + dy * dy <= size * size
    })?.signal ?? null
    return signal ? { payload: signal, cursor: 'pointer' } : null
  }, [renderNodes])

  return (
    <CanvasOverlay
      className="regional-overlay"
      width={viewport.width}
      height={viewport.height}
      visible={visible}
      draw={draw}
      hitTest={hitTest}
      onHit={(signal) => onSelectCountry?.(signal)}
    />
  )
}
