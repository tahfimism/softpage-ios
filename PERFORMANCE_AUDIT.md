# Performance Audit

This document outlines the performance bottlenecks, their estimated impact, root cause analysis, recommended fixes, risk assessment, and expected performance gains for the `softpage-ios` application.

## Overall Architecture
The `softpage-ios` app is a React Native app that uses `react-native-webview` for PDF processing. It uses `pdfjs-dist` to render PDF pages onto an HTML5 `<canvas>`, recolors them via a JavaScript loop in `recolor.js`, and then assembles the processed images into a new PDF using `pdf-lib`.

Communication between Native and WebView happens through `postMessage`. Because React Native bridges are asynchronous and memory constrained, string serializations (like base64 chunks) are used to transfer the PDFs.

## Performance Bottlenecks

### 1. Inefficient Recoloring Algorithm (High Impact, Medium Risk)
**Root Cause:**
The `recolorImageData` function processes image data pixel by pixel in a large loop. It uses floating point operations for every pixel (e.g., `lum = (r + g + b) / 3`, and subsequent calculations). It applies brightness/contrast before recoloring, which requires iterating over the array multiple times.

Additionally, `isInPhotoBlock` calculates `x` and `y` mathematically from `i` for *every* pixel, then does block lookups.

**Estimated Impact:** High. Rendering large, high-DPI pages freezes the WebView and delays processing significantly. This limits the maximum practical DPI and makes processing multiple pages very slow.

**Recommended Fixes:**
* Combine `applyBrightness`, `applyContrast`, and recoloring into a single pass to avoid multiple iterations over millions of pixels.
* Optimize math: Use integer arithmetic (e.g., bitwise shifts or fixed-point math) for luminosity and darkness calculations.
* Use `Uint32Array` views for reading/writing full pixels (RGBA) at once instead of separate R, G, B, A byte manipulations. This reduces array access by 4x.
* Precalculate block bounds or use optimized lookups instead of calculating `bx` and `by` for every pixel using division.

**Risk Assessment:** Medium. The recoloring logic needs to perfectly replicate the visual output. We must test the new optimizations against visual regressions.

**Expected Gain:** 2x-5x speedup in page processing time.

### 2. Photo Block Detection Inefficiency (Medium Impact, Low Risk)
**Root Cause:**
`detectPhotoBlocks` is recalculating `totalSat` and `lums` array on the fly. It iterates over blocks, then sub-iterates over pixels in those blocks. It builds an array of `lums` and iterates it again to calculate variance. Memory allocations for `lums` are excessive.

**Estimated Impact:** Medium. Causes garbage collection pauses and delays block detection.

**Recommended Fixes:**
* Calculate sum, sum-of-squares, and saturation in a single pass without allocating arrays for each block.
* Reuse existing typed arrays instead of `new ImageData` and `new Uint8ClampedArray(srcData)` inside `recolorImageData`.

**Risk Assessment:** Low. Pure math optimization.

**Expected Gain:** ~30% faster block detection, reduced GC overhead.

### 3. Frequent Debounced Previews Blocking the UI (Medium Impact, Low Risk)
**Root Cause:**
In `app/index.tsx`, modifying a setting triggers `triggerPreview` with a 400ms debounce. The preview rendering forces the WebView to process a page. Since WebView processing is single-threaded, it blocks any other operations. Furthermore, the base64 string transfer of a high-DPI image back to the UI might stutter.

**Estimated Impact:** Medium. UI responsiveness can stutter when adjusting sliders.

**Recommended Fixes:**
* Consider using lower DPI for the live preview to guarantee fast response times, decoupling preview DPI from export DPI.

**Risk Assessment:** Low.

**Expected Gain:** Smoother slider interactions and faster preview updates.

### 4. Excessive Base64 Data Transfers (High Impact, Low Risk)
**Root Cause:**
In `exportDocument` inside `processorHtml.ts`, each rendered page canvas is converted to base64, decoded to binary, then given to `pdf-lib` via `embedPng`. This intermediate base64 string creation (`canvas.toDataURL`) and `atob()` decoding are expensive and allocate huge amounts of memory.

**Estimated Impact:** High. Can lead to Out of Memory (OOM) crashes, especially on older iOS devices when exporting multi-page PDFs.

**Recommended Fixes:**
* Rather than `canvas.toDataURL`, investigate if `pdf-lib` supports embedding directly from raw typed arrays or `ImageData`, or if we can use a more efficient encoding/decoding strategy. However, since the browser API for converting canvas to PNG bytes typically involves `toDataURL` or `toBlob` (which is async and harder to coordinate), we can optimize `toDataURL`. We can also reduce the final chunk size strings.
* Actually, `canvas.toBlob()` is generally more memory-efficient than `toDataURL()`, but `FileReader` is needed to read it back into an `ArrayBuffer`. This is asynchronous but completely avoids Base64 overhead in the WebView memory.

**Risk Assessment:** Low.

**Expected Gain:** Lower memory footprint, reduced OOM crashes, faster assembly.

### 5. Network Dependency for Local App (Low Impact, Low Risk)
**Root Cause:**
`pdfjs-dist` and `pdf-lib` are loaded from `jsdelivr.net` dynamically inside the WebView.

**Estimated Impact:** Low/Medium. Prevents the app from functioning fully offline for the first run or if cache is cleared, causing delays.

**Recommended Fixes:**
* Since this app relies heavily on these libs, it would be beneficial to bundle them within the app's static assets or inject their source code strings if possible.

**Risk Assessment:** Low.

**Expected Gain:** Instant initialization, offline capability.

---

## Plan of Action (Prioritized)

1. **High Impact / Medium Risk**: Refactor `processorHtml.ts` to optimize the pixel processing loop (single pass, Uint32Array, integer math) in `recolorImageData` and `detectPhotoBlocks`.
2. **High Impact / Low Risk**: Refactor `exportDocument` to use `canvas.toBlob()` (if available) or optimize the serialization to avoid massive base64 string allocation in memory.
3. **Medium Impact / Low Risk**: Use a fixed, lower DPI for live previews to guarantee UI responsiveness during slider adjustments.

(Note: Bundling the JS libraries is out of scope unless required, as it involves significant build pipeline changes for React Native WebView local assets.)