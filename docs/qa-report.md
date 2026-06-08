# Bug and Contradiction Report

## 1. Executive Summary
The `softpage-ios` codebase exhibits multiple severe issues that threaten application stability, memory integrity, and core product promises. Overall risk is **Critical**. The transition to Expo SDK 54 introduces broken imports due to the deprecation of the legacy `expo-file-system` API. More importantly, there are major memory-management flaws when handling large PDFs via Base64 serialization across the React Native bridge. Finally, there are direct contradictions between the product's marketing claims ("100% On-Device") and its actual implementation (loading scripts via CDN), as well as architectural mismatches between the UI's progress indicator and the underlying monolithic processing engine.

## 2. Critical & Major Bugs

### [BUG-01]: Deprecated `expo-file-system` API causes runtime crashes and build failures
* **Severity:** Critical
* **Location:** `src/hooks/useWebViewBridge.ts` (Lines 114, 116) & `app/index.tsx` (Line 184)
* **Description:** The codebase imports legacy properties (`FileSystem.cacheDirectory`, `FileSystem.EncodingType`, and `FileSystem.writeAsStringAsync`) from `expo-file-system`. In Expo SDK 54, these legacy APIs were removed from the root export and moved to `expo-file-system/legacy`, or replaced by the new object-oriented `File` / `Directory` APIs. Attempting to access these missing properties will crash the app or throw TypeScript errors (e.g., `Property 'cacheDirectory' does not exist`).
* **Impact & Blast Radius:** Total application failure. The app will fail to typecheck, build, or run. When trying to save an exported PDF or load an initial PDF file, the app will crash due to undefined references.
* **Steps to Reproduce:**
  1. Run `npm run typecheck` or attempt to compile the app for iOS/Android.
  2. Observe `error TS2339: Property 'cacheDirectory' does not exist...`
  3. Load a PDF in the app and attempt to export it; observe the crash when it tries to write to undefined cache directory.
* **Recommended Fix:** Refactor the codebase to use the new Expo SDK 54 filesystem API or import the legacy API correctly.
  In `useWebViewBridge.ts`:
  ```typescript
  import { File, Paths } from 'expo-file-system';

  // Replace:
  // const fileUri = FileSystem.cacheDirectory + pendingFilenameRef.current;
  // await FileSystem.writeAsStringAsync(fileUri, base64Pdf, { encoding: FileSystem.EncodingType.Base64 });

  // With:
  const fileUri = `${Paths.cache.uri}${pendingFilenameRef.current}`;
  const file = new File(fileUri);
  await file.write(base64Pdf); // Writes automatically depending on string format/encoding support or convert Base64 properly.
  ```
  *(Note: if sticking to legacy, use `import * as FileSystem from 'expo-file-system/legacy';`)*

### [BUG-02]: OOM (Out Of Memory) Crash due to monolithic Base64 string aggregation in WebView
* **Severity:** High
* **Location:** `src/core/processorHtml.ts` (Lines 292-300)
* **Description:** In the `exportDocument` function inside the WebView, the code iterates over the PDF array of bytes, appending chunks to a single monolithic string using `String.fromCharCode.apply(null, chunk)` to generate the final Base64 string. For large PDFs, this creates a massive string in memory, doubling the memory footprint. Passing a 100MB+ Base64 string across the React Native WebView bridge (`postMessage`) will routinely crash the iOS app due to memory limits.
* **Impact & Blast Radius:** The app will reliably crash when exporting medium-to-large PDFs, rendering the app unusable for typical PDF payloads.
* **Steps to Reproduce:**
  1. Load a >50MB, 200-page PDF into the app.
  2. Press "Process & Export All Pages".
  3. Observe the app abruptly closing (OOM kill by iOS) as it attempts to serialize the massive PDF into a single string.
* **Recommended Fix:** Avoid passing massive Base64 strings across the RN bridge. Instead, the WebView should chunk the data and send it sequentially, or preferably, use a local web server / shared file access. For an immediate patch using strings, chunk the payload across the bridge:
  ```javascript
  // Instead of sending the whole base64 string at once:
  const pdfBytes = await newPdf.save();
  // ... chunk pdfBytes into smaller Base64 segments (e.g. 1MB each) ...
  // Send multiple { type: 'EXPORT_CHUNK', data: ... } messages.
  // Then send { type: 'EXPORT_COMPLETE' } and have RN reassemble it into a file.
  ```

### [BUG-03]: Timer Leak in `useWebViewBridge` during component unmount
* **Severity:** Medium
* **Location:** `src/hooks/useWebViewBridge.ts`
* **Description:** The `useWebViewBridge` hook uses a `setInterval` for tracking elapsed processing time (`startTimer`). However, there is no `useEffect` cleanup function that calls `stopTimer()` when the component utilizing the hook unmounts.
* **Impact & Blast Radius:** If the user navigates away from the screen while a PDF is processing, the interval will continue running indefinitely, causing state updates on an unmounted component, leading to memory leaks and background CPU usage.
* **Steps to Reproduce:**
  1. Load a PDF and start an export.
  2. Immediately navigate to a different screen (e.g., `/about`) to unmount `HomeScreen`.
  3. The timer continues firing, generating React warnings and leaking memory.
* **Recommended Fix:** Add a cleanup effect in `useWebViewBridge.ts`:
  ```typescript
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);
  ```

### [BUG-04]: Security vulnerability: Missing origin validation in `handleMessage`
* **Severity:** Medium
* **Location:** `src/core/processorHtml.ts` (Line 313)
* **Description:** The `window.addEventListener('message', handleMessage)` in the injected HTML listens to all `message` events but does not verify the origin or source of the message.
* **Impact & Blast Radius:** In a WebView with `allowFileAccess` and `originWhitelist={['*']}`, if a malicious PDF contains embedded scripts or if the WebView navigates, arbitrary postMessages could trigger unexpected execution.
* **Steps to Reproduce:** N/A (Theoretical code review finding)
* **Recommended Fix:** Validate the message type or origin. Because it's a local HTML string, `event.isTrusted` or checking `event.origin` could be added to ensure the message only comes from the React Native host.


## 3. Logical & Architectural Contradictions

### [CONTRAD-01]: Marketing Claim vs. CDN Dependency
* **Severity:** High
* **Location(s) Involved:** `README.md`, `app/index.tsx`, `src/core/processorHtml.ts` (Lines 207-213)
* **The Conflict:** The UI explicitly advertises "100% on-device — your files never leave your phone." However, `processorHtml.ts` injects `pdfjs-dist` and `pdf-lib` via public CDNs (`https://cdn.jsdelivr.net/...`). An internet connection is strictly required to run the engine.
* **Architectural Risk:** This breaks trust and prevents the app from working offline (e.g., airplane mode), negating a primary use case of local, private document processing.
* **Resolution Path:** Bundle `pdf.min.js`, `pdf.worker.min.js`, and `pdf-lib.min.js` locally within the React Native project (e.g., using Expo assets) and read them into the WebView or reference them via `expo-asset`, ensuring truly offline operation.

### [CONTRAD-02]: Monolithic PDF Generation vs. "Page-by-page memory" Claim
* **Severity:** Medium
* **Location(s) Involved:** `src/components/ProgressModal.tsx` (Line 72), `src/core/processorHtml.ts` (Lines 267-290)
* **The Conflict:** The `ProgressModal` assures the user: "Processing page-by-page to avoid memory issues." However, in `processorHtml.ts`, the `newPdf` instance accumulates all newly rendered PNGs (`newPdf.addPage()`) into a single `PDFDocument` in memory until completion. The memory grows linearly with the number of pages, directly contradicting the claim.
* **Architectural Risk:** The app will still crash on large documents because the memory is NOT flushed page-by-page; it is held in RAM until `await newPdf.save()` is called at the very end.
* **Resolution Path:** True page-by-page processing would require streaming the output. Since `pdf-lib` does not natively support streaming output incrementally to a file, the architecture should be revised to either compress intermediate PNGs heavily, downscale DPI dynamically if memory pressure is high, or rely on a native iOS module rather than a memory-constrained WebView.

### [CONTRAD-03]: Base64 Encoding Mismatch (String vs. FileSystem Enum)
* **Severity:** Medium
* **Location(s) Involved:** `app/index.tsx` (Line 183-185) vs. `src/hooks/useWebViewBridge.ts` (Lines 116-118)
* **The Conflict:** In `app/index.tsx`, `FileSystem.readAsStringAsync` is called with `{ encoding: 'base64' as any }` because the developer noted `FileSystem.EncodingType` might be undefined in SDK 54. Yet, in `useWebViewBridge.ts`, the developer blindly calls `FileSystem.writeAsStringAsync(..., { encoding: FileSystem.EncodingType.Base64 })`, which will be undefined and default to UTF-8, destroying the binary PDF payload.
* **Architectural Risk:** Inconsistent handling of deprecated constants across files leads to silent corruption of written files.
* **Resolution Path:** Standardize on the new Expo SDK 54 filesystem APIs throughout the entire codebase, eliminating legacy string-based encoding fallbacks.


## 4. Edge Cases & Minor Observations
* **WebView Ref Typing:** In `useWebViewBridge.ts` (Line 28), `useRef<WebView>(null)` results in a TypeScript mismatch with the `WebViewBridgeResult` interface which expects `React.RefObject<WebView>`. This causes a `tsc` error.
* **Missing Error Boundaries:** If the hidden WebView crashes (e.g. iOS terminates it for memory), the app stays in a generic loading or "Processing..." state forever because `onError` or `onMessage` is never triggered with a failure.
* **Unhandled Promise Rejections:** Several async calls (e.g., `saveLastSelectedPalettId` in `storage.ts`) wrap `AsyncStorage.setItem` in a `try...catch` but silently swallow the error (`catch (_) {}`). This obscures debugging if storage is full.
* **`String.fromCharCode.apply` limits:** In `processorHtml.ts`, using `String.fromCharCode.apply(null, chunk)` is restricted by the JavaScript engine's maximum call stack size. Even with a chunk size of 8192, this can throw `Maximum call stack size exceeded` in some older WebKit variants. A standard `TextDecoder` or manual loop is much safer.
* **Timer drift:** The elapsed time in `useWebViewBridge.ts` is calculated accurately via `Date.now()` differences, but relies on a 1000ms `setInterval`. Backgrounding the app on iOS will pause the JS thread, meaning the timer will jump abruptly when resumed.
