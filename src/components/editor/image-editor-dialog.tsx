"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Crop, Droplets, RotateCcw, Undo2, X } from "lucide-react"
import { type PointerEvent, useEffect, useRef, useState } from "react"
import ReactCrop, { type PercentCrop } from "react-image-crop"

import { Button } from "@/components/ui/button"
import type { ImageSource } from "@/lib/editor/types"

type Rect = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }
type Tool = "crop" | "blur"

const MIN_SELECTION = 8

function normalizeRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

function intersectRect(rect: Rect, bounds: Rect): Rect | null {
  const x = Math.max(rect.x, bounds.x)
  const y = Math.max(rect.y, bounds.y)
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width)
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

function getDisplayRect(source: ImageSource, viewport: { width: number; height: number }): Rect {
  const scale = Math.min(viewport.width / source.width, viewport.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  return { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2, width, height }
}

function getSourceCrop(crop: PercentCrop | undefined, width: number, height: number): Rect {
  if (!crop) return { x: 0, y: 0, width, height }
  const left = Math.max(0, Math.min(width - 1, Math.floor((crop.x / 100) * width)))
  const top = Math.max(0, Math.min(height - 1, Math.floor((crop.y / 100) * height)))
  const right = Math.max(left + 1, Math.min(width, Math.ceil(((crop.x + crop.width) / 100) * width)))
  const bottom = Math.max(top + 1, Math.min(height, Math.ceil(((crop.y + crop.height) / 100) * height)))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function ImageEditorDialog({ source, onClose, onApply }: {
  source: ImageSource
  onClose: () => void
  onApply: (blob: Blob, width: number, height: number) => void
}) {
  const [tool, setTool] = useState<Tool>("crop")
  const [crop, setCrop] = useState<PercentCrop>()
  const [blurRects, setBlurRects] = useState<Rect[]>([])
  const [blurStrength, setBlurStrength] = useState(18)
  const [draftRect, setDraftRect] = useState<Rect | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState("")
  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<Point | null>(null)

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const observer = new ResizeObserver(([entry]) => {
      setWorkspaceSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [])

  function getPoint(event: PointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    const display = getDisplayRect(source, { width: bounds.width, height: bounds.height })
    const point = {
      x: ((event.clientX - bounds.left - display.x) / display.width) * source.width,
      y: ((event.clientY - bounds.top - display.y) / display.height) * source.height,
    }
    return {
      x: Math.max(0, Math.min(source.width, point.x)),
      y: Math.max(0, Math.min(source.height, point.y)),
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = getPoint(event)
    dragStartRef.current = point
    setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStartRef.current) return
    setDraftRect(normalizeRect(dragStartRef.current, getPoint(event)))
  }

  function finishSelection(event: PointerEvent<HTMLDivElement>) {
    if (!dragStartRef.current) return
    const rect = normalizeRect(dragStartRef.current, getPoint(event))
    dragStartRef.current = null
    setDraftRect(null)
    if (rect.width < MIN_SELECTION || rect.height < MIN_SELECTION) return
    setBlurRects((current) => [...current, rect])
  }

  function selectTool(nextTool: Tool) {
    if (nextTool === tool) return
    setImageReady(false)
    setTool(nextTool)
  }

  function onImageError() {
    setImageReady(false)
    setError("The image preview could not be loaded.")
  }

  async function applyEdits() {
    const image = imageRef.current
    if (!image) return
    setIsApplying(true)
    setError("")
    try {
      const cropRect = getSourceCrop(crop, image.naturalWidth, image.naturalHeight)
      const canvas = document.createElement("canvas")
      canvas.width = cropRect.width
      canvas.height = cropRect.height
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Your browser could not create the image canvas.")
      context.drawImage(image, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height)

      blurRects.forEach((rect) => {
        const clipped = intersectRect(rect, cropRect)
        if (!clipped) return
        const localRect = { ...clipped, x: clipped.x - cropRect.x, y: clipped.y - cropRect.y }
        context.save()
        context.beginPath()
        context.rect(localRect.x, localRect.y, localRect.width, localRect.height)
        context.clip()
        context.filter = `blur(${blurStrength}px)`
        context.drawImage(image, -cropRect.x, -cropRect.y)
        context.restore()
      })

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("The browser could not encode the edited image.")
      onApply(blob, cropRect.width, cropRect.height)
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "The image could not be edited.")
    } finally {
      setIsApplying(false)
    }
  }

  const displayRect = getDisplayRect(source, workspaceSize)
  const cropRect = getSourceCrop(crop, source.width, source.height)
  const cropPath = `M 0 0 H ${source.width} V ${source.height} H 0 Z M ${cropRect.x} ${cropRect.y} H ${cropRect.x + cropRect.width} V ${cropRect.y + cropRect.height} H ${cropRect.x} Z`

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-zinc-900/45 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <Dialog.Popup className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:max-h-[calc(100dvh-3rem)] lg:h-[calc(100dvh-3rem)]">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-4 py-3 sm:px-5">
              <div>
                <Dialog.Title className="text-sm font-semibold">Crop and hide details</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-zinc-500">Crop the screenshot or blur sensitive areas before returning to the main editor.</Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close image editor" className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"><X className="size-4" /></Dialog.Close>
            </header>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="relative h-[38dvh] min-h-56 shrink-0 overflow-hidden bg-zinc-100 p-3 lg:h-auto lg:min-h-0 lg:flex-1 lg:p-6">
                <div
                  ref={workspaceRef}
                  role={tool === "blur" ? "img" : undefined}
                  aria-label={tool === "blur" ? "Drag over sensitive details to blur them" : undefined}
                  className={`relative flex size-full items-center justify-center overflow-hidden rounded-lg bg-zinc-200 shadow-lg ${tool === "blur" ? "touch-none cursor-cell" : ""}`}
                  onPointerDown={tool === "blur" ? onPointerDown : undefined}
                  onPointerMove={tool === "blur" ? onPointerMove : undefined}
                  onPointerUp={tool === "blur" ? finishSelection : undefined}
                  onPointerCancel={tool === "blur" ? () => { dragStartRef.current = null; setDraftRect(null) } : undefined}
                >
                  {tool === "crop" ? (
                    <ReactCrop
                      className="image-crop"
                      crop={crop}
                      keepSelection
                      minWidth={16}
                      minHeight={16}
                      ruleOfThirds
                      style={displayRect.width > 0 ? { width: displayRect.width, height: displayRect.height } : { maxWidth: "100%", maxHeight: "100%" }}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs cannot use the image optimizer. */}
                      <img
                        ref={imageRef}
                        src={source.url}
                        alt="Screenshot being cropped"
                        className="block object-contain"
                        style={displayRect.width > 0 ? { width: displayRect.width, height: displayRect.height } : { maxWidth: "100%", maxHeight: "100%" }}
                        onLoad={() => setImageReady(true)}
                        onError={onImageError}
                      />
                    </ReactCrop>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs cannot use the image optimizer. */}
                      <img ref={imageRef} src={source.url} alt="Screenshot being edited" className="pointer-events-none size-full object-contain" onLoad={() => setImageReady(true)} onError={onImageError} />
                      {displayRect.width > 0 && <div
                        className="pointer-events-none absolute overflow-hidden"
                        style={{ left: displayRect.x, top: displayRect.y, width: displayRect.width, height: displayRect.height }}
                      >
                        {[...blurRects, ...(draftRect ? [draftRect] : [])].map((rect, index) => <span key={`${index}-${rect.x}-${rect.y}`} className="pointer-events-none absolute border border-white/25 bg-white/5 backdrop-blur-md" style={{ left: `${(rect.x / source.width) * 100}%`, top: `${(rect.y / source.height) * 100}%`, width: `${(rect.width / source.width) * 100}%`, height: `${(rect.height / source.height) * 100}%` }} />)}
                        <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${source.width} ${source.height}`} preserveAspectRatio="none" aria-hidden="true">
                          <path d={cropPath} fill="rgba(7, 7, 10, .68)" fillRule="evenodd" />
                          <rect x={cropRect.x} y={cropRect.y} width={cropRect.width} height={cropRect.height} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>}
                    </>
                  )}
                </div>
                {!imageReady && <span className="absolute text-sm text-zinc-500">Loading image...</span>}
              </div>

              <aside className="w-full shrink-0 border-t border-zinc-200 p-4 lg:w-64 lg:border-t-0 lg:border-l lg:p-5">
                <div className="grid grid-cols-2 gap-2">
                  <button className={`rounded-xl border px-3 py-3 text-left transition ${tool === "crop" ? "border-red-500 bg-red-50 text-red-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"}`} onClick={() => selectTool("crop")}><Crop className="mb-2 size-4" /><span className="block text-xs font-medium">Crop</span></button>
                  <button className={`rounded-xl border px-3 py-3 text-left transition ${tool === "blur" ? "border-red-500 bg-red-50 text-red-700" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"}`} onClick={() => selectTool("blur")}><Droplets className="mb-2 size-4" /><span className="block text-xs font-medium">Blur</span></button>
                </div>
                <p className="mt-4 text-xs leading-5 text-zinc-500">{tool === "crop" ? "The full image is shown. Drag across it to select the area to keep." : "Drag a box over each name, email, or other detail you want hidden."}</p>

                {tool === "blur" && <label className="mt-5 block space-y-2"><span className="flex justify-between text-xs text-zinc-600"><span>Blur strength</span><span className="font-mono text-zinc-500">{blurStrength}px</span></span><input className="editor-range w-full accent-red-600" type="range" min={6} max={40} value={blurStrength} onChange={(event) => setBlurStrength(Number(event.target.value))} /></label>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" disabled={!blurRects.length} onClick={() => setBlurRects((current) => current.slice(0, -1))}><Undo2 /> Undo blur</Button>
                  <Button variant="ghost" size="sm" disabled={!crop} onClick={() => setCrop(undefined)}><RotateCcw /> Reset crop</Button>
                </div>
                <div className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 font-mono text-[10px] text-zinc-500">Output: {Math.round(cropRect.width)} x {Math.round(cropRect.height)} · {blurRects.length} blur {blurRects.length === 1 ? "area" : "areas"}</div>
              </aside>
            </div>

            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
              {error && <span className="mr-auto text-xs text-red-600" role="alert">{error}</span>}
              <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
              <Button disabled={!imageReady || isApplying} onClick={applyEdits}>{isApplying ? "Applying..." : "Apply changes"}</Button>
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
