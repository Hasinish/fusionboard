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

function applyRotation(ctx, el) {
  const cx = el.x + el.w / 2
  const cy = el.y + el.h / 2
  const rad = ((el.rotation || 0) * Math.PI) / 180
  ctx.translate(cx, cy)
  ctx.rotate(rad)
  ctx.translate(-cx, -cy)
}

export function drawPath(ctx, el) {
  const pts = (el.points || []).map(p => [p.x, p.y, p.pressure ?? 0.5])
  if (pts.length < 2) return
  ctx.save()
  if (el.rotation) applyRotation(ctx, el)
  const stroke = getStroke(pts, {
    size: el.width || el.strokeWidth || 2,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  })
  const pathStr = getSvgPathFromStroke(stroke)
  if (!pathStr) { ctx.restore(); return }
  const path = new Path2D(pathStr)
  ctx.fillStyle = el.color || el.stroke || '#000000'
  ctx.fill(path)
  ctx.restore()
}

export function drawRect(ctx, el) {
  ctx.save()
  if (el.rotation) applyRotation(ctx, el)
  ctx.fillStyle = el.fill || 'transparent'
  ctx.strokeStyle = el.stroke || '#000000'
  ctx.lineWidth = el.strokeWidth || 2
  ctx.globalAlpha = el.opacity ?? 1
  if (el.fill && el.fill !== 'transparent' && el.fill !== 'none') {
    ctx.beginPath()
    ctx.roundRect(el.x, el.y, el.w, el.h, 8)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, el.w, el.h, 8)
  ctx.stroke()
  // Text inside shape
  if (el.text) {
    const fontSize = el.fontSize || 14
    ctx.font = `${fontSize}px ${el.fontFamily || 'Inter, sans-serif'}`
    ctx.fillStyle = el.textColor || el.color || '#1e1e1e'
    ctx.textBaseline = 'middle'
    ctx.textAlign = el.textAlign || 'center'
    ctx.fillText(el.text, el.x + el.w / 2, el.y + el.h / 2, el.w - 16)
    ctx.textAlign = 'left'
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawEllipse(ctx, el) {
  ctx.save()
  if (el.rotation) applyRotation(ctx, el)
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2
  const rx = Math.max(0, el.w / 2 - (el.strokeWidth || 2) / 2)
  const ry = Math.max(0, el.h / 2 - (el.strokeWidth || 2) / 2)
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = el.fill || 'transparent'
  ctx.strokeStyle = el.stroke || '#000000'
  ctx.lineWidth = el.strokeWidth || 2
  ctx.globalAlpha = el.opacity ?? 1
  if (el.fill && el.fill !== 'transparent' && el.fill !== 'none') ctx.fill()
  ctx.stroke()
  if (el.text) {
    ctx.font = `${el.fontSize || 14}px ${el.fontFamily || 'Inter, sans-serif'}`
    ctx.fillStyle = el.textColor || el.color || '#1e1e1e'
    ctx.textBaseline = 'middle'
    ctx.textAlign = el.textAlign || 'center'
    ctx.fillText(el.text, cx, cy, el.w - 16)
    ctx.textAlign = 'left'
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawTriangle(ctx, el) {
  ctx.save()
  if (el.rotation) applyRotation(ctx, el)
  const sW = el.strokeWidth || 2
  ctx.beginPath()
  ctx.moveTo(el.x + el.w / 2, el.y + sW)
  ctx.lineTo(el.x + el.w - sW, el.y + el.h - sW)
  ctx.lineTo(el.x + sW, el.y + el.h - sW)
  ctx.closePath()
  ctx.fillStyle = el.fill || 'transparent'
  ctx.strokeStyle = el.stroke || '#000000'
  ctx.lineWidth = sW
  ctx.lineJoin = 'round'
  ctx.globalAlpha = el.opacity ?? 1
  if (el.fill && el.fill !== 'transparent' && el.fill !== 'none') ctx.fill()
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawArrow(ctx, el) {
  ctx.save()
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2
  const rad = ((el.rotation || 0) * Math.PI) / 180
  ctx.translate(cx, cy)
  ctx.rotate(rad)
  ctx.translate(-cx, -cy)
  const sW = el.strokeWidth || 3
  const headSize = 12
  const x1 = el.x + sW, y1 = el.y + el.h / 2
  const x2 = el.x + el.w - headSize, y2 = el.y + el.h / 2
  ctx.strokeStyle = el.stroke || el.color || '#000000'
  ctx.lineWidth = sW
  ctx.lineCap = 'round'
  ctx.globalAlpha = el.opacity ?? 1
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  // Arrowhead
  ctx.fillStyle = ctx.strokeStyle
  ctx.beginPath()
  ctx.moveTo(el.x + el.w - sW, el.y + el.h / 2)
  ctx.lineTo(el.x + el.w - headSize, el.y + el.h / 2 - headSize / 2)
  ctx.lineTo(el.x + el.w - headSize, el.y + el.h / 2 + headSize / 2)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawSticky(ctx, el) {
  ctx.save()
  ctx.globalAlpha = el.opacity ?? 1
  // Background
  ctx.fillStyle = el.fill || '#fef08a'
  ctx.strokeStyle = el.stroke || '#e2c94e'
  ctx.lineWidth = el.strokeWidth || 1
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, el.w, el.h, 4)
  ctx.fill()
  ctx.stroke()
  // Text (word-wrap)
  const fontSize = el.fontSize || 16
  ctx.font = `${fontSize}px ${el.fontFamily || 'Gloria Hallelujah, sans-serif'}`
  ctx.fillStyle = el.textColor || el.color || '#1e1e1e'
  ctx.textBaseline = 'top'
  const padding = 12
  const maxWidth = el.w - padding * 2
  const lineHeight = fontSize * 1.4
  const words = (el.text || '').split(' ')
  let line = '', y = el.y + padding
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, el.x + padding, y)
      line = word
      y += lineHeight
      if (y > el.y + el.h - padding) break
    } else { line = test }
  }
  if (line && y <= el.y + el.h - padding) ctx.fillText(line, el.x + padding, y)
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawText(ctx, el) {
  ctx.save()
  if (el.rotation) applyRotation(ctx, el)
  const fontSize = el.fontSize || 20
  ctx.font = `${el.fontWeight || 'normal'} ${fontSize}px ${el.fontFamily || 'Inter, sans-serif'}`
  ctx.fillStyle = el.textColor || el.color || el.stroke || '#000000'
  ctx.globalAlpha = el.opacity ?? 1
  ctx.textBaseline = 'top'
  ctx.textAlign = el.textAlign || 'left'
  const alignX = el.textAlign === 'center' ? el.x + el.w / 2
    : el.textAlign === 'right' ? el.x + el.w - 4
    : el.x + 4
  const lines = (el.text || '').split('\n')
  const lh = fontSize * 1.4
  lines.forEach((line, i) => {
    ctx.fillText(line, alignX, el.y + 4 + i * lh)
  })
  ctx.textAlign = 'left'
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawCode(ctx, el) {
  ctx.save()
  ctx.globalAlpha = el.opacity ?? 1
  ctx.fillStyle = el.fill || '#1e1e2e'
  ctx.strokeStyle = el.stroke || '#313244'
  ctx.lineWidth = el.strokeWidth || 1
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, el.w, el.h, 8)
  ctx.fill()
  ctx.stroke()
  // Language label
  ctx.font = 'bold 11px monospace'
  ctx.fillStyle = '#cdd6f4'
  ctx.textBaseline = 'top'
  ctx.fillText(el.language || 'code', el.x + 12, el.y + 10)
  // Code lines
  ctx.font = `${el.fontSize || 14}px monospace`
  ctx.fillStyle = el.textColor || '#cdd6f4'
  const lines = (el.code || '').split('\n').slice(0, 20)
  lines.forEach((line, i) => {
    ctx.fillText(line, el.x + 12, el.y + 30 + i * 18, el.w - 24)
  })
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawVideo(ctx, el) {
  ctx.save()
  ctx.globalAlpha = el.opacity ?? 1
  ctx.fillStyle = '#0f0f0f'
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, el.w, el.h, 8)
  ctx.fill()
  ctx.strokeStyle = el.stroke || '#313244'
  ctx.lineWidth = el.strokeWidth || 1
  ctx.stroke()
  // Play icon
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.moveTo(cx - 16, cy - 20)
  ctx.lineTo(cx - 16, cy + 20)
  ctx.lineTo(cx + 20, cy)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawGraph(ctx, el) {
  ctx.save()
  ctx.globalAlpha = el.opacity ?? 1
  ctx.fillStyle = el.fill || '#f8fafc'
  ctx.strokeStyle = el.stroke || '#d1d5db'
  ctx.lineWidth = el.strokeWidth || 1
  ctx.beginPath()
  ctx.roundRect(el.x, el.y, el.w, el.h, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#94a3b8'
  ctx.font = 'bold 13px Inter, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText('Graph', el.x + el.w / 2, el.y + el.h / 2)
  ctx.textAlign = 'left'
  ctx.globalAlpha = 1
  ctx.restore()
}

export function drawElement(ctx, el) {
  if (!el || !el.type) return
  try {
    ctx.save()
    if (el.isMarkedForErasure) ctx.globalAlpha = 0.3
    switch (el.type) {
      case 'path':     drawPath(ctx, el);     break
      case 'rect':     drawRect(ctx, el);     break
      case 'ellipse':  drawEllipse(ctx, el);  break
      case 'triangle': drawTriangle(ctx, el); break
      case 'arrow':    drawArrow(ctx, el);    break
      case 'sticky':   drawSticky(ctx, el);   break
      case 'text':     drawText(ctx, el);     break
      case 'code':     drawCode(ctx, el);     break
      case 'video':    drawVideo(ctx, el);    break
      case 'graph':    drawGraph(ctx, el);    break
    }
    ctx.restore()
  } catch (err) {
    ctx.restore()
    console.error('drawElement error for type', el.type, err)
  }
}
