import { clampRadius, getScreenshotRect } from "./geometry"
import { GRADIENTS } from "./defaults"
import type { EditorState } from "./types"

const SHADOWS = {
  off: { blur: 0, offsetY: 0, color: "transparent" },
  soft: { blur: 24, offsetY: 12, color: "rgba(15, 10, 30, .22)" },
  medium: { blur: 45, offsetY: 22, color: "rgba(15, 10, 30, .35)" },
  strong: { blur: 70, offsetY: 30, color: "rgba(15, 10, 30, .52)" },
} as const

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function drawPattern(context: CanvasRenderingContext2D, state: EditorState) {
  const { pattern, patternOpacity } = state.background
  if (pattern === "none" || patternOpacity === 0) return

  const { width, height } = state.canvas
  context.save()
  context.strokeStyle = `rgba(255, 255, 255, ${patternOpacity / 100})`
  context.fillStyle = context.strokeStyle
  context.lineWidth = 1.5

  if (pattern === "dots") {
    for (let y = 16; y < height; y += 32) {
      for (let x = 16; x < width; x += 32) {
        context.beginPath()
        context.arc(x, y, 2, 0, Math.PI * 2)
        context.fill()
      }
    }
  }

  if (pattern === "grid") {
    context.beginPath()
    for (let x = 0; x <= width; x += 48) {
      context.moveTo(x, 0)
      context.lineTo(x, height)
    }
    for (let y = 0; y <= height; y += 48) {
      context.moveTo(0, y)
      context.lineTo(width, y)
    }
    context.stroke()
  }

  if (pattern === "diagonal") {
    context.beginPath()
    for (let x = -height; x < width; x += 36) {
      context.moveTo(x, height)
      context.lineTo(x + height, 0)
    }
    context.stroke()
  }

  if (pattern === "crosses") {
    for (let y = 24; y < height; y += 48) {
      for (let x = 24; x < width; x += 48) {
        context.beginPath()
        context.moveTo(x - 4, y)
        context.lineTo(x + 4, y)
        context.moveTo(x, y - 4)
        context.lineTo(x, y + 4)
        context.stroke()
      }
    }
  }
  context.restore()
}

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function drawBackground(context: CanvasRenderingContext2D, state: EditorState) {
  const preset = GRADIENTS.find((item) => item.value === state.background.gradient) ?? GRADIENTS[0]
  const { width, height } = state.canvas

  if (preset.kind === "linear") {
    const gradient = context.createLinearGradient(0, 0, width, height)
    preset.colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, preset.colors.length - 1), color))
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    return
  }

  context.fillStyle = preset.colors[0]
  context.fillRect(0, 0, width, height)
  const anchors = [[0.18, 0.82], [0.82, 0.18], [0.68, 0.72]]
  preset.colors.slice(1).forEach((color, index) => {
    const [x, y] = anchors[index % anchors.length]
    const radial = context.createRadialGradient(width * x, height * y, 0, width * x, height * y, Math.max(width, height) * 0.65)
    const rgb = hexToRgb(color)
    radial.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .98)`)
    radial.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`)
    context.fillStyle = radial
    context.fillRect(0, 0, width, height)
  })
}

async function renderPng(state: EditorState, image: HTMLImageElement) {
  const exportScale = 2
  const canvas = document.createElement("canvas")
  canvas.width = state.canvas.width * exportScale
  canvas.height = state.canvas.height * exportScale
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Your browser could not create the export canvas.")

  context.scale(exportScale, exportScale)
  drawBackground(context, state)
  drawPattern(context, state)

  const rect = getScreenshotRect(state, image.naturalWidth, image.naturalHeight)
  const radius = clampRadius(state.screenshot.radius, rect.width, rect.height)
  const shadow = SHADOWS[state.screenshot.shadow]

  context.save()
  context.shadowBlur = shadow.blur
  context.shadowOffsetY = shadow.offsetY
  context.shadowColor = shadow.color
  roundedRect(context, rect.x, rect.y, rect.width, rect.height, radius)
  context.fillStyle = "#fff"
  context.fill()
  context.restore()

  context.save()
  roundedRect(context, rect.x, rect.y, rect.width, rect.height, radius)
  context.clip()
  context.filter = state.screenshot.blur ? `blur(${state.screenshot.blur}px)` : "none"
  const overscan = state.screenshot.blur * 2
  context.drawImage(image, rect.x - overscan, rect.y - overscan, rect.width + overscan * 2, rect.height + overscan * 2)
  context.restore()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("The browser could not encode this image.")
  return blob
}

export async function copyPng(state: EditorState, image: HTMLImageElement) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image copying is not supported by this browser.")
  }
  const blob = await renderPng(state, image)
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
}

export async function exportPng(state: EditorState, image: HTMLImageElement) {
  const blob = await renderPng(state, image)

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `webshot-${stamp}.png`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
