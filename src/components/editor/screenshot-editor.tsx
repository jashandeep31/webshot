"use client"

import { Copy, Download, ImagePlus, Redo2, RotateCcw, ScanLine, Sparkles, Undo2, Upload } from "lucide-react"
import { type ChangeEvent, type DragEvent, useEffect, useReducer, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ImageEditorDialog } from "@/components/editor/image-editor-dialog"
import { ASPECT_RATIOS, createDefaultState, GRADIENTS, PATTERNS } from "@/lib/editor/defaults"
import { getCanvasSize, getScreenshotRect } from "@/lib/editor/geometry"
import { copyPng, exportPng } from "@/lib/editor/render-export"
import type { EditorState, ImageSource, ShadowPreset } from "@/lib/editor/types"

type History = { past: EditorState[]; present: EditorState; future: EditorState[] }
type Action =
  | { type: "set"; state: EditorState }
  | { type: "reset"; state: EditorState }
  | { type: "undo" }
  | { type: "redo" }

function reducer(history: History, action: Action): History {
  if (action.type === "undo" && history.past.length) {
    return {
      past: history.past.slice(0, -1),
      present: history.past.at(-1)!,
      future: [history.present, ...history.future],
    }
  }
  if (action.type === "redo" && history.future.length) {
    return {
      past: [...history.past, history.present].slice(-50),
      present: history.future[0],
      future: history.future.slice(1),
    }
  }
  if (action.type === "set" || action.type === "reset") {
    return {
      past: [...history.past, history.present].slice(-50),
      present: action.state,
      future: [],
    }
  }
  return history
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

const PATTERN_STYLES: Record<Exclude<EditorState["background"]["pattern"], "none">, string> = {
  dots: "radial-gradient(circle, white 1.5px, transparent 1.75px)",
  grid: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
  diagonal: "repeating-linear-gradient(135deg, white 0 1px, transparent 1px 16px)",
  crosses: "linear-gradient(white, white), linear-gradient(white, white)",
}

function getPatternStyle(pattern: EditorState["background"]["pattern"], opacity: number) {
  if (pattern === "none") return undefined
  const sizes = {
    dots: "24px 24px",
    grid: "32px 32px",
    diagonal: "auto",
    crosses: "24px 24px, 24px 24px",
  }
  return {
    backgroundImage: PATTERN_STYLES[pattern],
    backgroundSize: sizes[pattern],
    backgroundPosition: pattern === "crosses" ? "center" : undefined,
    opacity: opacity / 100,
    WebkitMaskImage: pattern === "crosses" ? "linear-gradient(to right, transparent 9px, black 9px 15px, transparent 15px), linear-gradient(to bottom, transparent 9px, black 9px 15px, transparent 15px)" : undefined,
  }
}

export function ScreenshotEditor() {
  const [history, dispatch] = useReducer(reducer, {
    past: [],
    present: createDefaultState(),
    future: [],
  })
  const [source, setSource] = useState<ImageSource | null>(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("Add a screenshot to begin")
  const [isDragging, setIsDragging] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const sourceRef = useRef<ImageSource | null>(null)
  const state = history.present

  useEffect(() => {
    sourceRef.current = source
  }, [source])

  useEffect(() => () => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url)
  }, [])

  function update(recipe: (current: EditorState) => EditorState) {
    dispatch({ type: "set", state: recipe(state) })
  }

  function loadFile(file?: File) {
    if (!file) return
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      setError("Choose a PNG, JPEG, or WebP image.")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("This image is larger than the 25 MB limit.")
      return
    }

    const url = URL.createObjectURL(file)
    const probe = new Image()
    probe.onload = () => {
      const canvas = getCanvasSize(probe.naturalWidth, probe.naturalHeight, "auto")
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url)
      setSource({ url, width: probe.naturalWidth, height: probe.naturalHeight, name: file.name })
      dispatch({ type: "reset", state: createDefaultState(canvas.width, canvas.height) })
      setError("")
      setStatus(`${file.name} added locally`)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(url)
      setError("This image could not be read. Try another file.")
    }
    probe.src = url
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"))
      if (file) loadFile(file)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  })

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    loadFile(event.target.files?.[0])
    event.target.value = ""
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setIsDragging(false)
    loadFile(event.dataTransfer.files[0])
  }

  function applyImageEdits(blob: Blob, width: number, height: number) {
    const url = URL.createObjectURL(blob)
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url)
    const name = source?.name.replace(/\.[^.]+$/, "-edited.png") ?? "edited-screenshot.png"
    const size = getCanvasSize(width, height, state.canvas.aspectRatio)
    setSource({ url, width, height, name })
    dispatch({
      type: "set",
      state: {
        ...state,
        canvas: {
          ...state.canvas,
          ...size,
          padding: Math.min(state.canvas.padding, Math.round(Math.min(size.width, size.height) * 0.35)),
        },
      },
    })
    setIsImageEditorOpen(false)
    setError("")
    setStatus("Crop and blur changes applied")
  }

  function setAspectRatio(aspectRatio: EditorState["canvas"]["aspectRatio"]) {
    if (!source) return
    const size = getCanvasSize(source.width, source.height, aspectRatio)
    update((current) => ({
      ...current,
      canvas: {
        ...current.canvas,
        ...size,
        aspectRatio,
        padding: Math.min(current.canvas.padding, Math.round(Math.min(size.width, size.height) * 0.35)),
      },
    }))
  }

  async function handleExport() {
    if (!imageRef.current) return
    setIsExporting(true)
    try {
      await exportPng(state, imageRef.current)
      setStatus("PNG exported")
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed.")
    } finally {
      setIsExporting(false)
    }
  }

  async function handleCopy() {
    if (!imageRef.current) return
    setIsCopying(true)
    try {
      await copyPng(state, imageRef.current)
      setError("")
      setStatus("Image copied to clipboard")
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Copy failed.")
    } finally {
      setIsCopying(false)
    }
  }

  const rect = source ? getScreenshotRect(state, source.width, source.height) : null
  const screenshotStyle = rect ? {
    left: `${(rect.x / state.canvas.width) * 100}%`,
    top: `${(rect.y / state.canvas.height) * 100}%`,
    width: `${(rect.width / state.canvas.width) * 100}%`,
    height: `${(rect.height / state.canvas.height) * 100}%`,
    borderRadius: `${(state.screenshot.radius / rect.width) * 100}% / ${(state.screenshot.radius / rect.height) * 100}%`,
    filter: state.screenshot.blur ? `blur(${state.screenshot.blur}px)` : undefined,
  } : undefined

  return (
    <main className="flex min-h-dvh flex-col bg-[#0d0d0f] text-zinc-100">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/8 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-xl bg-violet-500 text-white shadow-[0_0_24px_rgba(139,92,246,.35)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Webshot</h1>
            <p className="hidden text-[11px] text-zinc-500 sm:block">Private screenshot studio</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button aria-label="Undo" title="Undo" variant="ghost" size="icon" disabled={!history.past.length} onClick={() => dispatch({ type: "undo" })}><Undo2 /></Button>
          <Button aria-label="Redo" title="Redo" variant="ghost" size="icon" disabled={!history.future.length} onClick={() => dispatch({ type: "redo" })}><Redo2 /></Button>
          <Button variant="ghost" className="hidden sm:flex" onClick={() => dispatch({ type: "reset", state: createDefaultState(state.canvas.width, state.canvas.height) })}><RotateCcw /> Reset</Button>
          <Button aria-label="Copy image" title="Copy image" className="ml-2 bg-violet-500 hover:bg-violet-400" size="icon" disabled={!source || isCopying || isExporting} onClick={handleCopy}><Copy /></Button>
          <Button aria-label="Export PNG" title="Export PNG" className="bg-violet-500 hover:bg-violet-400" size="icon" disabled={!source || isExporting || isCopying} onClick={handleExport}><Download /></Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          className={`relative flex min-h-[52vh] items-center justify-center overflow-hidden p-5 sm:p-10 lg:min-h-0 ${isDragging ? "bg-violet-500/10" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:18px_18px]" />
          {source ? (
            <div className="relative flex size-full items-center justify-center">
              <div
                className="relative max-h-full max-w-full overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.45)]"
                style={{
                  aspectRatio: `${state.canvas.width} / ${state.canvas.height}`,
                  width: `min(100%, calc((100vh - 10rem) * ${state.canvas.width / state.canvas.height}))`,
                  background: state.background.gradient,
                }}
              >
                <div className="absolute -inset-8" style={{ background: state.background.gradient, filter: state.background.blur ? `blur(${state.background.blur}px)` : undefined }} />
                <div className="pointer-events-none absolute inset-0" style={getPatternStyle(state.background.pattern, state.background.patternOpacity)} />
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs cannot use the image optimizer. */}
                <img
                  ref={imageRef}
                  src={source.url}
                  alt={`Editing ${source.name}`}
                  className={`absolute object-fill ${state.screenshot.shadow === "soft" ? "shadow-[0_12px_24px_rgba(15,10,30,.22)]" : state.screenshot.shadow === "medium" ? "shadow-[0_22px_45px_rgba(15,10,30,.35)]" : state.screenshot.shadow === "strong" ? "shadow-[0_30px_70px_rgba(15,10,30,.52)]" : ""}`}
                  style={screenshotStyle}
                />
              </div>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                <button className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-300/25 bg-violet-500/85 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-violet-400" onClick={() => setIsImageEditorOpen(true)}><ScanLine className="size-3.5" /> Crop &amp; blur</button>
                <button className="whitespace-nowrap rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur hover:bg-black/80" onClick={() => fileInputRef.current?.click()}>Replace image</button>
              </div>
            </div>
          ) : (
            <button className="group relative z-10 flex w-full max-w-lg flex-col items-center rounded-[2rem] border border-dashed border-white/15 bg-white/[.025] px-8 py-16 text-center transition hover:border-violet-400/50 hover:bg-violet-500/[.04] focus-visible:outline-2 focus-visible:outline-violet-400 sm:py-24" onClick={() => fileInputRef.current?.click()}>
              <span className="mb-6 grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/[.04] shadow-xl transition group-hover:-translate-y-1 group-hover:border-violet-400/30"><ImagePlus className="size-7 text-violet-300" /></span>
              <span className="text-lg font-medium">Drop your screenshot here</span>
              <span className="mt-2 text-sm text-zinc-500">Paste from clipboard or click to browse</span>
              <span className="mt-6 flex items-center gap-2 rounded-lg bg-white/[.06] px-3 py-2 text-xs text-zinc-400"><Upload className="size-3.5" /> PNG, JPEG or WebP up to 25 MB</span>
            </button>
          )}
          {isDragging && <div className="pointer-events-none absolute inset-4 z-20 grid place-items-center rounded-3xl border-2 border-dashed border-violet-400 bg-violet-500/10 text-sm font-medium">Drop to add screenshot</div>}
        </section>

        <aside className="relative z-30 overflow-y-auto border-t border-white/8 bg-[#131316] lg:border-t-0 lg:border-l">
          <div className="space-y-7 p-5 sm:p-6">
            <ControlSection title="Canvas" eyebrow={`${state.canvas.width} x ${state.canvas.height}`}>
              <div className="grid grid-cols-5 gap-1 rounded-xl bg-black/25 p-1">
                {ASPECT_RATIOS.map((ratio) => <button key={ratio.value} disabled={!source} className={`rounded-lg px-1 py-2 text-xs transition ${state.canvas.aspectRatio === ratio.value ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`} onClick={() => setAspectRatio(ratio.value)}>{ratio.label}</button>)}
              </div>
              <RangeControl label="Padding" value={state.canvas.padding} min={0} max={Math.round(Math.min(state.canvas.width, state.canvas.height) * 0.35)} suffix="px" disabled={!source} onChange={(padding) => update((current) => ({ ...current, canvas: { ...current.canvas, padding } }))} />
            </ControlSection>

            <ControlSection title="Background">
              <div className="grid grid-cols-3 gap-2">
                {GRADIENTS.map((gradient) => (
                  <button
                    key={gradient.name}
                    aria-label={gradient.name}
                    title={gradient.name}
                    disabled={!source}
                    className={`group overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 ${state.background.gradient === gradient.value ? "border-violet-300 ring-2 ring-violet-400/25" : "border-white/10 hover:border-white/25"}`}
                    onClick={() => update((current) => ({ ...current, background: { ...current.background, gradient: gradient.value } }))}
                  >
                    <span className="block h-11" style={{ background: gradient.value }} />
                    <span className="block truncate bg-black/25 px-2 py-1.5 text-[9px] font-medium text-zinc-400 group-hover:text-zinc-200">{gradient.name}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-400">Pattern layer</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {PATTERNS.map((pattern) => (
                    <button
                      key={pattern.value}
                      type="button"
                      title={pattern.label}
                      aria-label={`${pattern.label} pattern`}
                      disabled={!source}
                      className={`group relative aspect-square overflow-hidden rounded-lg border transition ${state.background.pattern === pattern.value ? "border-violet-400 bg-violet-500/15 ring-1 ring-violet-400/30" : "border-white/10 bg-white/[.04] hover:border-white/25"}`}
                      onClick={() => update((current) => ({ ...current, background: { ...current.background, pattern: pattern.value } }))}
                    >
                      {pattern.value === "none" ? <span className="absolute inset-0 bg-[linear-gradient(135deg,transparent_47%,rgba(255,255,255,.25)_48%,rgba(255,255,255,.25)_52%,transparent_53%)]" /> : <span className="absolute inset-0 opacity-50" style={getPatternStyle(pattern.value, 55)} />}
                    </button>
                  ))}
                </div>
              </div>
              <RangeControl label="Pattern intensity" value={state.background.patternOpacity} min={5} max={50} suffix="%" disabled={!source || state.background.pattern === "none"} onChange={(patternOpacity) => update((current) => ({ ...current, background: { ...current.background, patternOpacity } }))} />
              <RangeControl label="Background blur" value={state.background.blur} min={0} max={80} suffix="px" disabled={!source} onChange={(blur) => update((current) => ({ ...current, background: { ...current.background, blur } }))} />
            </ControlSection>

            <ControlSection title="Screenshot">
              <RangeControl label="Scale" value={state.screenshot.scale} min={40} max={100} suffix="%" disabled={!source} onChange={(scale) => update((current) => ({ ...current, screenshot: { ...current.screenshot, scale } }))} />
              <RangeControl label="Corner radius" value={state.screenshot.radius} min={0} max={48} suffix="px" disabled={!source} onChange={(radius) => update((current) => ({ ...current, screenshot: { ...current.screenshot, radius } }))} />
              <RangeControl label="Screenshot blur" value={state.screenshot.blur} min={0} max={40} suffix="px" disabled={!source} onChange={(blur) => update((current) => ({ ...current, screenshot: { ...current.screenshot, blur } }))} />
              <label className="block text-xs font-medium text-zinc-400">Shadow</label>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/25 p-1">
                {(["off", "soft", "medium", "strong"] as ShadowPreset[]).map((shadow) => <button key={shadow} disabled={!source} className={`rounded-lg py-2 text-[11px] capitalize transition ${state.screenshot.shadow === shadow ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`} onClick={() => update((current) => ({ ...current, screenshot: { ...current.screenshot, shadow } }))}>{shadow}</button>)}
              </div>
            </ControlSection>
          </div>
        </aside>
      </div>

      <input ref={fileInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} />
      {source && isImageEditorOpen && <ImageEditorDialog source={source} onClose={() => setIsImageEditorOpen(false)} onApply={applyImageEdits} />}
      <div className="sr-only" aria-live="polite">{error || status}</div>
      {error && <button className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-400/20 bg-red-950/90 px-4 py-3 text-sm text-red-100 shadow-2xl" onClick={() => setError("")}>{error}</button>}
    </main>
  )
}

function ControlSection({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-b border-white/[.07] pb-7 last:border-0"><div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[.14em] text-zinc-300">{title}</h2>{eyebrow && <span className="font-mono text-[10px] text-zinc-600">{eyebrow}</span>}</div>{children}</section>
}

function RangeControl({ label, value, min, max, suffix, disabled, onChange }: { label: string; value: number; min: number; max: number; suffix: string; disabled: boolean; onChange: (value: number) => void }) {
  return <label className={`block space-y-2 ${disabled ? "opacity-40" : ""}`}><span className="flex items-center justify-between text-xs font-medium text-zinc-400"><span>{label}</span><span className="font-mono text-[11px] text-zinc-500">{value}{suffix}</span></span><input className="editor-range w-full accent-violet-500" type="range" value={value} min={min} max={max} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>
}
