import { useEffect, useRef, useCallback } from 'react'
import { CanvasRenderer } from './CanvasRenderer.js'

export function useCanvasRenderer(canvasRef, boardStore) {
  const rendererRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const renderer = new CanvasRenderer(canvasRef.current)
    rendererRef.current = renderer
    renderer.start()

    const resizeObserver = new ResizeObserver(() => {
      if (!canvasRef.current || !rendererRef.current) return
      const dpr = window.devicePixelRatio || 1
      const canvas = canvasRef.current
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (w === 0 || h === 0) return
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      renderer.ctx = ctx
      renderer._logicalW = w
      renderer._logicalH = h
    })
    resizeObserver.observe(canvasRef.current)

    return () => {
      renderer.stop()
      resizeObserver.disconnect()
      rendererRef.current = null
    }
  }, [canvasRef])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    if (!boardStore) {
      renderer.setElements([])
      renderer.setOrder([])
      return
    }

    renderer.setElements(boardStore.getOrderedElements())
    renderer.setOrder(boardStore.getOrderedIds())

    const unsubscribeChanges = boardStore.subscribeToChanges((batch) => {
      batch.forEach((change) => {
        if (change.type === 'delete') {
          renderer.deleteElement(change.id)
        } else if (change.type === 'set' && change.element) {
          renderer.updateElement(change.element)
        }
      })
    })

    const unsubscribeOrder = boardStore.subscribeToOrder(() => {
      renderer.setOrder(boardStore.getOrderedIds())
    })

    return () => {
      unsubscribeChanges()
      unsubscribeOrder()
    }
  }, [boardStore])

  const syncOverlays = useCallback((overrides) => {
    if (rendererRef.current) rendererRef.current.syncOverlays(overrides)
  }, [])

  return { rendererRef, syncOverlays }
}
