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
    this.camera = { x: 0, y: 0, z: 1 }

    // Overlay state — set from outside via syncOverlays()
    this.remoteLiveStrokes = {}
    this.cursors = {}
    this.eraserPath = null
    this.selectionBox = null
    this.currentPath = null
    this.bgMode = 'white'
    this.isDark = false
    this.myUserId = null
    this.autoShapePreview = null
    this.localCursor = null // { tool, x, y, width, color } in screen coords

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
    if (!Array.isArray(arr)) return
    arr.forEach(el => { if (el?.id) this.elements.set(el.id, el) })
  }

  updateElement(el) {
    if (!el?.id) return
    this.elements.set(el.id, el)
  }

  deleteElement(id) { this.elements.delete(id) }

  syncOverlays(overrides) { Object.assign(this, overrides) }

  getElementsArray() {
    return Array.from(this.elements.values())
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
    const { ctx, bgMode, isDark } = this
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
    for (const el of this.elements.values()) {
      if (['text', 'code', 'video', 'graph', 'sticky'].includes(el.type)) continue
      drawElement(ctx, el)
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

    for (const [userId, state] of Object.entries(this.cursors)) {
      if (userId !== String(this.myUserId)) {
        drawCursor(ctx, userId, state, camera)
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
