export type AspectRatio = "auto" | "1:1" | "4:3" | "3:2" | "16:9" | "9:16"

export type ShadowPreset = "off" | "soft" | "medium" | "strong"
export type PatternPreset = "none" | "dots" | "grid" | "diagonal" | "crosses"

export type EditorState = {
  canvas: {
    width: number
    height: number
    aspectRatio: AspectRatio
    padding: number
  }
  background: {
    gradient: string
    blur: number
    pattern: PatternPreset
    patternOpacity: number
  }
  screenshot: {
    scale: number
    radius: number
    blur: number
    shadow: ShadowPreset
  }
}

export type ImageSource = {
  url: string
  width: number
  height: number
  name: string
}
