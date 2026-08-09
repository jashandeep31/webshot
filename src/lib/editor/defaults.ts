import type { AspectRatio, EditorState, PatternPreset } from "./types"

export const GRADIENTS = [
  {
    name: "Big Sur",
    kind: "mesh",
    colors: ["#311b68", "#ff4f81", "#ff9a62", "#7448e8"],
    value: "radial-gradient(circle at 18% 82%, #ff9a62 0%, transparent 43%), radial-gradient(circle at 82% 18%, #7448e8 0%, transparent 48%), radial-gradient(circle at 72% 78%, #ff4f81 0%, transparent 48%), #311b68",
  },
  {
    name: "Monterey",
    kind: "mesh",
    colors: ["#101457", "#ed4b86", "#7257ff", "#3cc8ff"],
    value: "radial-gradient(circle at 8% 15%, #3cc8ff 0%, transparent 42%), radial-gradient(circle at 88% 82%, #ed4b86 0%, transparent 48%), radial-gradient(circle at 55% 32%, #7257ff 0%, transparent 52%), #101457",
  },
  {
    name: "Ventura",
    kind: "mesh",
    colors: ["#34114f", "#ff753f", "#ed286c", "#7738d1"],
    value: "radial-gradient(ellipse at 12% 50%, #ff753f 0%, transparent 46%), radial-gradient(ellipse at 86% 28%, #7738d1 0%, transparent 48%), radial-gradient(ellipse at 65% 85%, #ed286c 0%, transparent 50%), #34114f",
  },
  {
    name: "Sonoma",
    kind: "mesh",
    colors: ["#160b38", "#f43996", "#7759ff", "#ee7aa7"],
    value: "radial-gradient(circle at 25% 20%, #f43996 0%, transparent 42%), radial-gradient(circle at 78% 68%, #7759ff 0%, transparent 50%), radial-gradient(circle at 18% 90%, #ee7aa7 0%, transparent 38%), #160b38",
  },
  {
    name: "Sequoia",
    kind: "mesh",
    colors: ["#182629", "#b75236", "#e49d58", "#647b68"],
    value: "radial-gradient(circle at 18% 18%, #e49d58 0%, transparent 40%), radial-gradient(circle at 82% 78%, #647b68 0%, transparent 48%), radial-gradient(circle at 62% 22%, #b75236 0%, transparent 43%), #182629",
  },
  {
    name: "Windows Bloom",
    kind: "mesh",
    colors: ["#071846", "#1859d8", "#58b8ff", "#7a5cff"],
    value: "radial-gradient(ellipse at 22% 80%, #1859d8 0%, transparent 48%), radial-gradient(ellipse at 74% 22%, #58b8ff 0%, transparent 45%), radial-gradient(ellipse at 88% 85%, #7a5cff 0%, transparent 42%), #071846",
  },
  {
    name: "Aurora",
    kind: "linear",
    colors: ["#5b43f1", "#a856d8", "#ff8b64"],
    value: "linear-gradient(135deg, #5b43f1 0%, #a856d8 48%, #ff8b64 100%)",
  },
  {
    name: "Northern Lights",
    kind: "mesh",
    colors: ["#041f2d", "#00d79f", "#168aad", "#7048e8"],
    value: "radial-gradient(ellipse at 18% 18%, #00d79f 0%, transparent 42%), radial-gradient(ellipse at 70% 72%, #168aad 0%, transparent 50%), radial-gradient(ellipse at 94% 12%, #7048e8 0%, transparent 42%), #041f2d",
  },
  {
    name: "Solar Flare",
    kind: "linear",
    colors: ["#6b1024", "#eb4d36", "#ffb23e"],
    value: "linear-gradient(145deg, #6b1024 0%, #eb4d36 52%, #ffb23e 100%)",
  },
  {
    name: "Ocean",
    kind: "linear",
    colors: ["#075985", "#0891b2", "#67e8f9"],
    value: "linear-gradient(135deg, #075985 0%, #0891b2 52%, #67e8f9 100%)",
  },
  {
    name: "Midnight",
    kind: "mesh",
    colors: ["#070711", "#172554", "#3730a3", "#701a75"],
    value: "radial-gradient(circle at 14% 82%, #3730a3 0%, transparent 46%), radial-gradient(circle at 82% 16%, #701a75 0%, transparent 42%), radial-gradient(circle at 72% 75%, #172554 0%, transparent 50%), #070711",
  },
  {
    name: "Mint",
    kind: "linear",
    colors: ["#064e3b", "#10b981", "#a7f3d0"],
    value: "linear-gradient(135deg, #064e3b 0%, #10b981 55%, #a7f3d0 100%)",
  },
] as const

export const ASPECT_RATIOS: { label: string; value: AspectRatio }[] = [
  { label: "Auto", value: "auto" },
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
]

export const PATTERNS: { label: string; value: PatternPreset }[] = [
  { label: "None", value: "none" },
  { label: "Dots", value: "dots" },
  { label: "Grid", value: "grid" },
  { label: "Diagonal", value: "diagonal" },
  { label: "Crosses", value: "crosses" },
]

export function createDefaultState(width = 1600, height = 1000): EditorState {
  return {
    canvas: {
      width,
      height,
      aspectRatio: "auto",
      padding: Math.round(Math.min(width, height) * 0.1),
    },
    background: {
      gradient: GRADIENTS[0].value,
      blur: 0,
      pattern: "none",
      patternOpacity: 18,
    },
    screenshot: {
      scale: 90,
      radius: 24,
      blur: 0,
      shadow: "medium",
    },
  }
}
