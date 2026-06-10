# Performance Refactor Plan

1. **Refactor Recoloring Engine (High Impact)**
   - Modify `src/core/processorHtml.ts`.
   - Update `recolorImageData` to use `Uint32Array` for pixel manipulation (4x reduction in array accesses).
   - Combine brightness, contrast, and recoloring into a single pass.
   - Use integer math for luminosity calculations.
   - Optimize `isInPhotoBlock` to avoid unnecessary math per pixel.

2. **Optimize Photo Block Detection (Medium Impact)**
   - Update `detectPhotoBlocks` in `src/core/processorHtml.ts`.
   - Remove the `lums` array allocation per block. Calculate variance using sum of squares on the fly.

3. **Optimize Canvas to PNG Data (High Impact, Memory)**
   - Update `exportDocument` in `src/core/processorHtml.ts`.
   - Replace `canvas.toDataURL` with `canvas.toBlob` and `FileReader` to get ArrayBuffer without the huge Base64 intermediate string allocation.

4. **Lower DPI for Live Previews (Medium Impact, UX)**
   - Modify `src/core/processorHtml.ts` or `src/hooks/useWebViewBridge.ts`.
   - Ensure the `renderPreview` command uses a hardcoded low DPI (e.g., 72 or 96) or downscales the user's selected DPI, so the preview generation is fast and the UI remains responsive during slider drags.

5. **Complete pre commit steps**
   - Run necessary checks before submitting the changes.

6. **Submit**
   - Submit the refactored code.