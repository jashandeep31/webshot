# Webshot Product and Engineering Plan

## 1. Product Summary

Webshot is a local-first screenshot editor inspired by tools such as Pika. A user can paste, drop, or select a screenshot, place it on a polished background, adjust the presentation, and export a share-ready image.

The first version should make one workflow exceptionally fast:

1. Add a screenshot.
2. Choose or customize a background.
3. Adjust spacing, shape, shadow, position, and blur.
4. Export a high-quality image.

Screenshots should remain in the browser. The MVP does not need accounts, storage, a database, or a server-side image pipeline.

## 2. Product Goals

- Reach a useful canvas within one action: paste, drop, or upload.
- Make attractive results possible with presets, not design expertise.
- Keep every important visual control available without making the UI feel dense.
- Match the live preview and downloaded image as closely as possible.
- Work well on desktop and remain usable on tablet and mobile.
- Preserve privacy by processing images locally.

## 3. Non-Goals for MVP

- Multi-user collaboration.
- Cloud projects, authentication, or synchronization.
- Multiple independently editable screenshots on one canvas.
- Full graphic-design features such as arbitrary text, shapes, drawing, or layers.
- Video, GIF, or animated exports.
- Browser-extension screenshot capture.
- AI image generation or AI editing.

These can be considered only after the core screenshot-to-export workflow is reliable.

## 4. MVP User Stories

- As a user, I can paste a screenshot directly from my clipboard.
- As a user, I can drag and drop or browse for PNG, JPEG, or WebP images.
- As a user, I can choose a solid color, gradient, preset, or image-based background.
- As a user, I can blur the background without blurring the screenshot.
- As a user, I can blur the screenshot independently when it contains sensitive information.
- As a user, I can adjust canvas aspect ratio, padding, screenshot size, position, corner radius, and shadow.
- As a user, I can compare changes immediately in a responsive preview.
- As a user, I can reset settings or undo an accidental change.
- As a user, I can export PNG, JPEG, or WebP at a selected resolution.

## 5. Editor Experience

### Desktop Layout

- Top bar: product name, undo, redo, reset, export.
- Left or center workspace: large checkerboard-neutral stage containing the output canvas.
- Right inspector: grouped controls for Canvas, Background, Screenshot, and Export.
- Empty state: focused drop zone with paste and browse instructions.
- The canvas scales to fit the workspace while retaining its true output dimensions internally.

### Mobile Layout

- Preview occupies the upper portion of the screen.
- Controls appear in a bottom sheet or compact tabbed panel.
- Export stays reachable in a sticky header or footer.
- Sliders and number inputs must have touch-friendly targets.

### Visual Direction

- Dark, focused editing workspace so the artwork remains visually dominant.
- Compact neutral controls using the existing shadcn/base-nova system.
- Presets shown as visual swatches rather than text-only select menus.
- Restraint in decoration: the generated image, not the application chrome, is the focal point.

## 6. Controls and Defaults

### Canvas

- Aspect ratios: Auto, 1:1, 4:3, 3:2, 16:9, 9:16, and custom dimensions later.
- Initial output size: derived from the screenshot and chosen ratio, capped to a safe maximum.
- Padding: linked horizontal/vertical padding for MVP, default around 10% of the shorter canvas edge.
- Alignment: nine-point grid, default center.
- Zoom: preview-only fit control; it must not alter exported dimensions.

### Background

- Types: solid, gradient preset, custom gradient, transparent, and optional uploaded image.
- Curated preset gallery for fast attractive results.
- Background blur: `0-80px`, applied only to the background layer.
- Background scale/position when using an image.
- Optional subtle grain can be a post-MVP enhancement.

### Screenshot

- Scale: constrained so the image remains within the canvas by default.
- Position: alignment controls in MVP; drag positioning can follow once export parity is proven.
- Corner radius: `0-48px`.
- Shadow: Off, Soft, Medium, Strong presets, with advanced controls later.
- Screenshot blur: `0-40px`, independent from background blur.
- Optional border: width, color, and opacity.

### Export

- Formats: PNG by default; JPEG and WebP for smaller files.
- Scale: 1x, 2x, and 3x, constrained by browser canvas limits.
- JPEG/WebP quality: default `0.92`.
- Transparent background supported only for PNG/WebP.
- File name: `webshot-YYYY-MM-DD-HHMMSS.ext`.

## 7. State Model

Use a serializable `EditorState` as the single source of truth. Keep the decoded image object and object URL outside serializable history state.

```ts
type EditorState = {
  canvas: {
    width: number
    height: number
    aspectRatio: "auto" | "1:1" | "4:3" | "3:2" | "16:9" | "9:16"
    padding: number
  }
  background: {
    type: "solid" | "gradient" | "transparent" | "image"
    color: string
    gradient: GradientDefinition
    blur: number
    imageFit: "cover" | "contain"
  }
  screenshot: {
    scale: number
    alignX: "start" | "center" | "end"
    alignY: "start" | "center" | "end"
    offsetX: number
    offsetY: number
    radius: number
    blur: number
    border: BorderSettings
    shadow: ShadowSettings
  }
  export: {
    format: "png" | "jpeg" | "webp"
    scale: 1 | 2 | 3
    quality: number
  }
}
```

Implementation guidance:

- Start with React `useReducer`; do not add a global state library for a single editor route.
- Keep transient slider updates lightweight and commit meaningful snapshots to history.
- Cap undo/redo history, for example at 50 snapshots.
- Keep the original image dimensions and never repeatedly re-encode the source.
- Revoke object URLs when images are replaced or the editor unmounts.

## 8. Rendering Architecture

### Live Preview

Use layered DOM elements because they are responsive, accessible, and fast to iterate:

1. Canvas container with the selected aspect ratio.
2. Background layer with color, gradient, or image and its own blur filter.
3. Screenshot layer with clipping, radius, shadow, border, transform, and independent blur.
4. Optional selection/drag overlay that is never included in export.

The preview uses a calculated display scale so state values remain in output pixels while the canvas fits the available workspace.

### Export Renderer

Create a dedicated Canvas 2D renderer rather than taking a screenshot of the DOM. This gives deterministic output dimensions, avoids browser UI artifacts, and keeps export independent from preview zoom.

Render in this order:

1. Size the canvas to `outputWidth * exportScale` and `outputHeight * exportScale`.
2. Paint transparency, solid color, gradient, or background image.
3. Apply background blur on an overscanned offscreen canvas to avoid transparent blur edges.
4. Calculate screenshot contain dimensions, alignment, and offsets.
5. Paint shadow outside the screenshot clipping path.
6. Clip to the rounded rectangle.
7. Draw the screenshot with its independent blur filter.
8. Draw the border.
9. Encode with `canvas.toBlob()` and trigger a download.

Preview and export must share pure geometry helpers for dimensions, position, radius, and scale. This is the most important defense against preview/export mismatch.

### Why Not a Canvas Framework Yet

Konva or Fabric would add bundle size and a second rendering abstraction. The MVP edits one screenshot with constrained controls, so DOM preview plus native Canvas 2D export is simpler. Reconsider a canvas framework only when multiple draggable/resizable objects become a committed requirement.

## 9. File and Component Structure

```text
src/
  app/
    page.tsx                     # Server entry and metadata shell
  components/
    editor/
      screenshot-editor.tsx     # Client editor composition
      editor-toolbar.tsx
      editor-stage.tsx
      empty-state.tsx
      control-panel.tsx
      canvas-controls.tsx
      background-controls.tsx
      screenshot-controls.tsx
      export-dialog.tsx
      preset-grid.tsx
    ui/                          # shadcn components
  hooks/
    use-editor-state.ts
    use-image-input.ts
    use-history.ts
  lib/
    editor/
      types.ts
      defaults.ts
      geometry.ts
      gradients.ts
      render-export.ts
      image.ts
    utils.ts
```

Keep components grouped by real responsibilities. Do not split every slider into a project-specific component unless behavior is reused.

## 10. Input Pipeline

- Accept clipboard paste on the editor page when the clipboard contains an image.
- Support drag/drop and a hidden file input.
- Accept PNG, JPEG, and WebP initially.
- Reject unsupported files with a clear toast or inline error.
- Decode with `createImageBitmap` where supported, with `HTMLImageElement` as fallback.
- Respect image orientation during decode.
- Validate dimensions and file size before rendering.
- Warn before decoding unusually large images; downscale only a working copy while preserving clear user expectations.
- Never upload the source image in the MVP.

Suggested initial limits:

- Input file size: 25 MB.
- Input dimensions: warn above 12,000 px on either axis.
- Export dimensions: guard against the browser-specific maximum canvas area and show a helpful error instead of failing silently.

## 11. Presets

Start with a small curated set rather than dozens of near-duplicates:

- Solid: Paper, Ink, Warm Gray.
- Gradients: Aurora, Sunset, Ocean, Grape, Mint, Ember.
- Screenshot styles: Floating, Window, Minimal, Card.
- Canvas sizes: Social Square, Landscape Post, Presentation, Story.

Presets should update normal editor state, not create a separate styling path. After applying one, every value remains independently editable.

## 12. Accessibility and Interaction Requirements

- Every control has a visible label and keyboard-operable input.
- Sliders pair with numeric values and sensible min/max/step values.
- Buttons have tooltips only where the label is not visible.
- Focus remains visible in the dark editor interface.
- Paste and drop are conveniences; file browsing must always remain available.
- Status changes such as image loaded or export complete use an `aria-live` region or accessible toast.
- Respect reduced-motion preferences.
- Do not rely on color alone to show selection.

## 13. Performance Requirements

- Slider interactions should visually respond within one animation frame on typical screenshots.
- Use CSS transforms for preview position and scale.
- Avoid rendering a full-resolution Canvas on every slider movement; render full resolution only during export.
- Use `requestAnimationFrame` if rapid slider changes need coalescing.
- Keep large decoded images and background bitmaps out of React state.
- Move export rendering to a worker with `OffscreenCanvas` only if profiling shows main-thread stalls; do not add this complexity preemptively.
- Lazy-load the export dialog or renderer if its bundle becomes significant.

## 14. Error Handling

Provide actionable messages for:

- Clipboard permission denied or clipboard without an image.
- Unsupported or corrupt image.
- Image exceeds safe decode limits.
- Browser cannot allocate the requested export canvas.
- Export encoding fails.
- Background image fails to decode.

Errors must preserve the current edit whenever possible. Export failures should never clear state.

## 15. Testing Strategy

### Unit Tests

- Aspect-ratio and canvas-size calculations.
- Screenshot contain dimensions and nine-point alignment.
- Padding, offsets, and export scaling.
- Rounded-rectangle radius clamping.
- Preset-to-state conversion.
- Reducer actions and undo/redo behavior.
- Export file-name generation and input validation.

### Component Tests

- Paste, drop, and file selection reach the same image-loading path.
- Controls update the preview state.
- Reset restores defaults.
- Unsupported images display an error.
- Export options enable and disable valid combinations.

### End-to-End Tests

- Load a known fixture, apply settings, export PNG, and verify dimensions.
- Verify screenshot blur and background blur are independent.
- Verify changing preview zoom does not change output dimensions.
- Exercise keyboard navigation through the core workflow.
- Run the workflow at desktop and mobile viewport sizes.

### Visual Regression Tests

Create a few stable fixtures covering:

- Solid background with radius and shadow.
- Gradient background with background blur.
- Screenshot blur.
- Transparent export.
- Portrait and landscape source images.

Because browser image encoding can vary, compare rendered pixels with a small threshold rather than comparing encoded files byte-for-byte.

## 16. Delivery Milestones

### Milestone 1: Editor Shell

- Replace the starter page and metadata.
- Build the responsive desktop/mobile editor layout.
- Add the required shadcn controls.
- Implement the empty state and sample-image option.
- Establish `EditorState`, defaults, reducer, and history.

Exit criteria: the editor layout is responsive and all placeholder controls can update visible state.

### Milestone 2: Image Input and Preview

- Implement clipboard paste, drag/drop, and file selection.
- Decode and validate source images.
- Build the layered live preview.
- Implement canvas ratio, padding, alignment, scale, radius, border, and shadow.

Exit criteria: a user can add an image and produce a composed preview without export.

### Milestone 3: Backgrounds and Blur

- Add solid, transparent, and gradient backgrounds.
- Add curated presets and custom colors.
- Add optional background image input.
- Implement independent background and screenshot blur.

Exit criteria: all visual controls work independently and remain smooth on representative images.

### Milestone 4: Export

- Implement shared geometry helpers.
- Build the Canvas 2D renderer.
- Add PNG, JPEG, and WebP output with scale and quality controls.
- Add limits, progress state, errors, and deterministic filenames.

Exit criteria: exports have the requested dimensions and visually match preview fixtures.

### Milestone 5: Quality and Release

- Add unit, component, end-to-end, and visual tests.
- Complete accessibility and keyboard review.
- Profile large-image interactions and export.
- Add onboarding hints, reset confirmation, and privacy copy.
- Replace the generated README with project instructions.

Exit criteria: lint, type checks, production build, automated tests, and the manual release checklist all pass.

## 17. MVP Acceptance Criteria

- A user can paste, drop, or browse for a supported screenshot.
- The source image is processed entirely in the browser.
- The user can configure canvas ratio and padding.
- The user can choose solid, gradient, transparent, or image backgrounds.
- Background blur and screenshot blur operate independently.
- The user can configure screenshot scale, alignment, radius, border, and shadow.
- The preview works at desktop and mobile widths.
- PNG, JPEG, and WebP exports have correct dimensions and expected quality.
- Exported output matches the preview within documented rendering tolerance.
- Invalid and oversized inputs produce actionable errors.
- Core controls are keyboard accessible.
- Lint, production build, and automated tests pass.

## 18. Recommended Dependencies

Use the platform and current project dependencies first:

- Existing Next.js, React, Tailwind CSS, shadcn, Base UI, and Lucide.
- Native Canvas 2D, Clipboard, File, Blob, and object URL APIs.
- Add a small color picker only if native color inputs are insufficient for the intended control design.
- Add a test stack when implementation starts, likely Vitest, React Testing Library, and Playwright.

Avoid adding a canvas framework, state library, upload service, or image-processing library until a measured requirement justifies it.

## 19. Post-MVP Opportunities

- Drag-to-position and resize handles.
- Selective blur/redaction regions instead of blurring the entire screenshot.
- Browser-window chrome and device mockups.
- Text, arrows, and annotation layers.
- Saved local projects through IndexedDB.
- Shareable cloud links and authenticated project history.
- Custom reusable presets.
- Batch export and multiple screenshots.
- Browser extension and direct screen capture.

## 20. First Implementation Slice

The first code slice should prove the architecture before polishing every control:

1. Create the editor shell and responsive stage.
2. Add one image through paste/drop/file input.
3. Support one gradient background, padding, radius, shadow, and both blur controls.
4. Export that exact composition to PNG with native Canvas 2D.
5. Compare preview and export using a known fixture.

Once this vertical slice works, expand presets, formats, history, and advanced controls without changing the core rendering model.
