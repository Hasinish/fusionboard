import { drawElement } from './drawElements.js'
import {
  drawCursor,
  drawLiveStroke,
  drawEraserTrail,
  drawSelectionMarquee
} from './drawOverlays.js'

export class CanvasRenderer {
  constructor(canvasEl, topCanvasEl, overlayCanvasEl) {
    this.canvas = canvasEl
    this.ctx = canvasEl.getContext('2d')
    this.topCanvas = topCanvasEl
    this.topCtx = topCanvasEl ? topCanvasEl.getContext('2d') : null
    this.overlayCanvas = overlayCanvasEl
    this.overlayCtx = overlayCanvasEl ? overlayCanvasEl.getContext('2d') : null
    this.elements = new Map()
    this.elementOrder = []
    this.previewElements = new Map()
    this.hiddenElementIds = new Set()
    this.overlayElementIds = new Set()
    this.camera = { x: 0, y: 0, z: 1 }

    // Overlay state — set from outside via syncOverlays()
    this.remoteLiveStrokes = {}
    this.cursors = {}
    this.lerpedCursors = new Map()
    this.lerpedElements = new Map()
    this.eraserPath = null
    this.selectionBox = null
    this.currentPath = null
    this.bgMode = 'white'
    this.isDark = false
    this.myUserId = null
    this.autoShapePreview = null
    this.localCursor = null // { tool, x, y, width, color } in screen coords
    this.selectedIds = new Set()

    this._rafId = null
    this._running = false
    this._logicalW = 0
    this._logicalH = 0
  }

  // ─── Public API ────────────────────────────────────────────
  start() {
    this._running = true
    this._setupCanvas()
    this._loop()
  }

  stop() {
    this._running = false
    if (this._rafId) cancelAnimationFrame(this._rafId)
  }

  setCamera(cam) { this.camera = cam }

  setElements(arr) {
    this.elements.clear()
    this.elementOrder = []
    if (!Array.isArray(arr)) return
    arr.forEach(el => {
      if (!el?.id) return
      this.elements.set(el.id, el)
      this.elementOrder.push(el.id)
    })
  }

  setOrder(ids) {
    this.elementOrder = Array.isArray(ids) ? [...ids] : []
  }

  updateElement(el) {
    if (!el?.id) return
    this.elements.set(el.id, el)
    if (!this.elementOrder.includes(el.id)) {
      this.elementOrder.push(el.id)
    }
  }

  deleteElement(id) {
    this.elements.delete(id)
    this.previewElements.delete(id)
    this.hiddenElementIds.delete(id)
    this.elementOrder = this.elementOrder.filter(existingId => existingId !== id)
  }

  setPreviewElements(previews) {
    this.previewElements.clear()
    if (previews instanceof Map) {
      previews.forEach((value, key) => {
        if (value?.id) this.previewElements.set(key, value)
      })
      return
    }
    if (Array.isArray(previews)) {
      previews.forEach((value) => {
        if (value?.id) this.previewElements.set(value.id, value)
      })
      return
    }
    if (previews && typeof previews === 'object') {
      Object.entries(previews).forEach(([id, value]) => {
        if (value?.id) this.previewElements.set(id, value)
      })
    }
  }

  setHiddenElementIds(ids) {
    this.hiddenElementIds = new Set(Array.isArray(ids) ? ids : [])
  }

  setOverlayElementIds(ids) {
    this.overlayElementIds = new Set(Array.isArray(ids) ? ids : [])
  }

  syncOverlays(overrides) { Object.assign(this, overrides) }

  getElementsArray() {
    return this.elementOrder
      .map(id => this.elements.get(id))
      .filter(Boolean)
  }

  // ─── Private ───────────────────────────────────────────────
  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1
    const canvas = this.canvas
    const w = canvas.offsetWidth, h = canvas.offsetHeight
    if (w === 0 || h === 0) return
    canvas.width = w * dpr
    canvas.height = h * dpr
    this.ctx.scale(dpr, dpr)
    if (this.topCanvas) {
      this.topCanvas.width = w * dpr
      this.topCanvas.height = h * dpr
      this.topCtx = this.topCanvas.getContext('2d')
      this.topCtx.scale(dpr, dpr)
    }
    if (this.overlayCanvas) {
      this.overlayCanvas.width = w * dpr
      this.overlayCanvas.height = h * dpr
      this.overlayCtx = this.overlayCanvas.getContext('2d')
      this.overlayCtx.scale(dpr, dpr)
    }
    this._logicalW = w
    this._logicalH = h
  }

  _drawBackground() {
    const { ctx } = this
    const w = this._logicalW || this.canvas.offsetWidth
    const h = this._logicalH || this.canvas.offsetHeight

    // Background is drawn by CSS on the wrapper div, so we just clear
    ctx.clearRect(0, 0, w, h)
    if (this.topCtx) { this.topCtx.clearRect(0, 0, w, h) }
    if (this.overlayCtx) { this.overlayCtx.clearRect(0, 0, w, h) }
  }

  _loop() {
    if (!this._running) return
    const { ctx, camera } = this
    const w = this._logicalW || this.canvas.offsetWidth
    const h = this._logicalH || this.canvas.offsetHeight
    if (w === 0 || h === 0) {
      this._rafId = requestAnimationFrame(() => this._loop())
      return
    }

    this._drawBackground()

    // World-space rendering (apply camera transform)
    ctx.save()
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.z, camera.z)

    if (this.topCtx) {
      this.topCtx.save()
      this.topCtx.translate(camera.x, camera.y)
      this.topCtx.scale(camera.z, camera.z)
    }

    // Draw all committed elements
    for (const id of this.elementOrder) {
      const rawEl = this.elements.get(id)
      if (!rawEl) continue

      // Elements completely replaced by React (always rendered by React)
      if (['text', 'code', 'video', 'graph', 'sticky', 'mermaid'].includes(rawEl.type)) continue

      if (this.previewElements.has(id)) continue

      let el = rawEl
      if (this.selectedIds && !this.selectedIds.has(id)) {
        // Remote element: Lerp it
        let current = this.lerpedElements.get(id)
        if (!current) {
          current = { ...rawEl }
          this.lerpedElements.set(id, current)
        } else {
          // Keep non-lerpable properties updated
          for (const key in rawEl) {
            if (!['x', 'y', 'w', 'h', 'rotation'].includes(key)) {
              current[key] = rawEl[key]
            }
          }
          // Lerp properties
          if (rawEl.x != null) current.x += (rawEl.x - current.x) * 0.3
          if (rawEl.y != null) current.y += (rawEl.y - current.y) * 0.3
          if (rawEl.w != null) current.w += (rawEl.w - current.w) * 0.3
          if (rawEl.h != null) current.h += (rawEl.h - current.h) * 0.3
          
          if (rawEl.rotation != null) {
              if (current.rotation == null) current.rotation = rawEl.rotation
              else {
                  let diff = rawEl.rotation - current.rotation;
                  while (diff < -180) diff += 360;
                  while (diff > 180) diff -= 360;
                  current.rotation += diff * 0.3;
              }
          }
        }
        el = current
      } else {
        // Local element: Snap immediately, but update lerp cache to prevent rubber-banding on deselect
        this.lerpedElements.set(id, { ...rawEl })
      }

      if (this.hiddenElementIds.has(id)) {
        // Draw eraser-marked elements as faded ghosts
        drawElement(ctx, { ...el, opacity: 0.18 })
        continue
      }
      
      // If it's in the overlay (e.g., selected rect, code block, text), 
      // React is handling the entire rendering (shape + text).
      // We skip it on the canvas to avoid "duplicate" ghosting/double-rendering.
      if (this.overlayElementIds.has(el.id)) {
        continue
      }
      
      // Shapes and Penstrokes should be drawn on the top canvas (above blocks at z-index 15)
      const isBlock = ['code', 'image', 'graph', 'video', 'mermaid'].includes(el.type);
      if (isBlock) continue;
      
      const targetCtx = this.topCtx || ctx;
      drawElement(targetCtx, el)
    }

    // Garbage collect removed lerped elements
    for (const id of this.lerpedElements.keys()) {
        if (!this.elements.has(id)) {
            this.lerpedElements.delete(id)
        }
    }

    for (const el of this.previewElements.values()) {
      if (!el?.id || this.hiddenElementIds.has(el.id)) continue

      // Elements completely replaced by React
      if (['text', 'code', 'video', 'graph', 'sticky', 'mermaid'].includes(el.type)) continue

      // If it's in the overlay, React is handling it.
      if (this.overlayElementIds.has(el.id)) {
        continue
      }

      const targetCtx = this.topCtx ? this.topCtx : ctx
      drawElement(targetCtx, el)
    }

    // Draw the local live stroke being drawn right now (already in world coords)
    if (this.currentPath && this.currentPath.points && this.currentPath.points.length >= 2) {
      const targetCtx = this.topCtx ? this.topCtx : ctx
      drawElement(targetCtx, {
        type: 'path',
        points: this.currentPath.points,
        color: this.currentPath.color,
        width: this.currentPath.width, // Ensure the live stroke uses the selected width
      })
    }

    if (this.autoShapePreview) {
      ctx.save()
      ctx.globalAlpha = 0.6
      drawElement(ctx, this.autoShapePreview)
      ctx.restore()
    }

    if (this.topCtx) this.topCtx.restore()
    ctx.restore() // end world-space

    // Screen-space overlays (world→screen conversion is done internally)
    const oCtx = this.overlayCtx || ctx;
    for (const [userId, stroke] of Object.entries(this.remoteLiveStrokes)) {
      drawLiveStroke(oCtx, userId, stroke, camera)
    }

    // Clean up stale lerped cursors
    for (const userId of this.lerpedCursors.keys()) {
      if (!this.cursors[userId]) {
        this.lerpedCursors.delete(userId)
      }
    }

    for (const [userId, state] of Object.entries(this.cursors)) {
      if (userId !== String(this.myUserId)) {
        let current = this.lerpedCursors.get(userId)
        if (!current) {
          current = { ...state }
          this.lerpedCursors.set(userId, current)
        } else {
          // Lerp position
          current.x += (state.x - current.x) * 0.3
          current.y += (state.y - current.y) * 0.3
          // Keep metadata up to date
          current.name = state.name
          current.color = state.color
        }
        drawCursor(oCtx, userId, current, camera)
      }
    }

    if (this.eraserPath) drawEraserTrail(oCtx, this.eraserPath, camera)
    if (this.selectionBox) drawSelectionMarquee(oCtx, this.selectionBox, camera)

    // Draw the local cursor (lag-free rendering)
    if (this.localCursor) {
      const { tool, x, y, width, color } = this.localCursor
      if (tool === 'eraser') {
        oCtx.save()
        oCtx.beginPath()
        oCtx.arc(x, y, 12, 0, Math.PI * 2)
        oCtx.strokeStyle = '#f87171'
        oCtx.lineWidth = 2
        oCtx.stroke()
        oCtx.fillStyle = 'rgba(239,68,68,0.1)'
        oCtx.fill()
        oCtx.restore()
      } else if (tool === 'pen') {
        oCtx.save()
        oCtx.beginPath()
        const z = this.camera.z
        oCtx.arc(x, y, (width || 2) * z / 2, 0, Math.PI * 2)
        oCtx.strokeStyle = color || '#000000'
        oCtx.lineWidth = 1
        oCtx.stroke()
        oCtx.fillStyle = `${color || '#000000'}20`
        oCtx.fill()
        oCtx.restore()
      }
    }

    this._rafId = requestAnimationFrame(() => this._loop())
  }
}
