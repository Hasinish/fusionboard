import getStroke from 'perfect-freehand'

function getSvgPathFromStroke(points) {
  if (!points.length) return ''
  const d = points.reduce((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length]
    return `${acc} ${x0.toFixed(1)},${y0.toFixed(1)} ${
      ((x0 + x1) / 2).toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`
  }, `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)} Q`)
  return d + ' Z'
}

export function drawCursor(ctx, userId, state, camera) {
  if (!state || state.x == null) return
  const sx = state.x * camera.z + camera.x
  const sy = state.y * camera.z + camera.y
  const color = state.color || '#3b82f6'
  // Dot
  ctx.beginPath()
  ctx.arc(sx, sy, 5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  // Name pill
  if (state.name) {
    ctx.font = 'bold 11px Inter, sans-serif'
    const textW = ctx.measureText(state.name).width
    const pillW = textW + 12, pillH = 20
    const px = sx + 8, py = sy + 8
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(px, py, pillW, pillH, 10)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText(state.name, px + 6, py + pillH / 2)
  }
}

export function drawLiveStroke(ctx, userId, stroke, camera) {
  if (!stroke || !stroke.points || stroke.points.length < 2) return
  const screenPts = stroke.points.map(p => [
    p.x * camera.z + camera.x,
    p.y * camera.z + camera.y,
    p.pressure ?? 0.5
  ])
  const stroked = getStroke(screenPts, {
    size: (stroke.width || stroke.strokeWidth || 2) * camera.z,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  })
  if (!stroked.length) return
  const pathStr = getSvgPathFromStroke(stroked)
  const path = new Path2D(pathStr)
  ctx.fillStyle = stroke.color || '#000000'
  ctx.globalAlpha = stroke.opacity ?? 0.85
  ctx.fill(path)
  ctx.globalAlpha = 1
}

export function drawEraserTrail(ctx, eraserPath, camera) {
  if (!eraserPath || eraserPath.length < 2) return
  ctx.beginPath()
  eraserPath.forEach((p, i) => {
    const sx = p.x * camera.z + camera.x
    const sy = p.y * camera.z + camera.y
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  })
  ctx.strokeStyle = 'rgba(239,68,68,0.4)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.setLineDash([])
}

export function drawSelectionMarquee(ctx, selectionBox, camera) {
  if (!selectionBox) return
  const sx = Math.min(
    selectionBox.x * camera.z + camera.x,
    (selectionBox.x + selectionBox.w) * camera.z + camera.x
  )
  const sy = Math.min(
    selectionBox.y * camera.z + camera.y,
    (selectionBox.y + selectionBox.h) * camera.z + camera.y
  )
  const sw = Math.abs(selectionBox.w * camera.z)
  const sh = Math.abs(selectionBox.h * camera.z)
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 3])
  ctx.strokeRect(sx, sy, sw, sh)
  ctx.fillStyle = 'rgba(59,130,246,0.08)'
  ctx.fillRect(sx, sy, sw, sh)
  ctx.setLineDash([])
}
