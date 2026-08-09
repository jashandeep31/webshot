import type { AspectRatio, EditorState } from "./types"

const RATIOS: Record<Exclude<AspectRatio, "auto">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
}

export function getCanvasSize(sourceWidth: number, sourceHeight: number, aspectRatio: AspectRatio) {
  const longestEdge = Math.min(2400, Math.max(sourceWidth, sourceHeight, 1000))

  if (aspectRatio === "auto") {
    const padding = Math.round(Math.min(sourceWidth, sourceHeight) * 0.12)
    const scale = Math.min(1, 2200 / Math.max(sourceWidth + padding * 2, sourceHeight + padding * 2))
    return {
      width: Math.round((sourceWidth + padding * 2) * scale),
      height: Math.round((sourceHeight + padding * 2) * scale),
    }
  }

  const ratio = RATIOS[aspectRatio]
  if (ratio >= 1) return { width: longestEdge, height: Math.round(longestEdge / ratio) }
  return { width: Math.round(longestEdge * ratio), height: longestEdge }
}

export function getScreenshotRect(state: EditorState, sourceWidth: number, sourceHeight: number) {
  const availableWidth = Math.max(1, state.canvas.width - state.canvas.padding * 2)
  const availableHeight = Math.max(1, state.canvas.height - state.canvas.padding * 2)
  const containScale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight)
  const scale = containScale * (state.screenshot.scale / 100)
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  return {
    x: (state.canvas.width - width) / 2,
    y: (state.canvas.height - height) / 2,
    width,
    height,
  }
}

export function clampRadius(radius: number, width: number, height: number) {
  return Math.max(0, Math.min(radius, width / 2, height / 2))
}
