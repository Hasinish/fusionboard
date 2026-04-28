import { drawElement } from './drawElements.js'
import {
  drawCursor,
  drawLiveStroke,
  drawEraserTrail,
  drawSelectionMarquee
} from './drawOverlays.js'

export class CanvasRenderer {
  constructor(canvasEl) {
    this.canvas = canvasEl
    this.ctx = canvasEl.getContext('2d')
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
    this._logicalW = w
    this._logicalH = h
  }

  _drawBackground() {
    const { ctx } = this
    const w = this._logicalW || this.canvas.offsetWidth
    const h = this._logicalH || this.canvas.offsetHeight

    // Background is drawn by CSS on the wrapper div, so we just clear
    ctx.clearRect(0, 0, w, h)
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

    // Draw all committed elements
    for (const id of this.elementOrder) {
      const rawEl = this.elements.get(id)
      if (!rawEl) continue

      // Elements completely replaced by React (always rendered by React)
      if (['text', 'code', 'video', 'graph', 'sticky'].includes(rawEl.type)) continue

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
      
      // If it's in the overlay (e.g., selected rect), React is drawing the text box.
      // So tell the canvas to draw the shape, but NOT the text.
      const skipText = this.overlayElementIds.has(id)
      drawElement(ctx, skipText ? { ...el, text: null } : el)
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
      if (['text', 'code', 'video', 'graph', 'sticky'].includes(el.type)) continue

      const skipText = this.overlayElementIds.has(el.id)
      drawElement(ctx, skipText ? { ...el, text: null } : el)
    }

    // Draw the local live stroke being drawn right now (already in world coords)
    if (this.currentPath && this.currentPath.points && this.currentPath.points.length >= 2) {
      drawElement(ctx, {
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

    ctx.restore() // end world-space

    // Screen-space overlays (world→screen conversion is done internally)
    for (const [userId, stroke] of Object.entries(this.remoteLiveStrokes)) {
      drawLiveStroke(ctx, userId, stroke, camera)
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
        drawCursor(ctx, userId, current, camera)
      }
    }

    if (this.eraserPath) drawEraserTrail(ctx, this.eraserPath, camera)
    if (this.selectionBox) drawSelectionMarquee(ctx, this.selectionBox, camera)

    // Draw the local cursor (lag-free rendering)
    if (this.localCursor) {
      const { tool, x, y, width, color } = this.localCursor
      if (tool === 'eraser') {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, 12, 0, Math.PI * 2)
        ctx.strokeStyle = '#f87171' // red-400
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = 'rgba(239,68,68,0.1)'
        ctx.fill()
        ctx.restore()
      } else if (tool === 'pen') {
        ctx.save()
        ctx.beginPath()
        const z = this.camera.z
        ctx.arc(x, y, (width || 2) * z / 2, 0, Math.PI * 2)
        ctx.strokeStyle = color || '#000000'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = `${color || '#000000'}20`
        ctx.fill()
        ctx.restore()
      }
    }

    this._rafId = requestAnimationFrame(() => this._loop())
  }
}
