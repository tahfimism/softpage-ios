/**
 * processorHtml.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * This module exports a single string: the complete HTML document that is
 * injected into the hidden react-native-webview.
 *
 * It bundles:
 *   • pdfjs-dist  – renders PDF pages to <canvas>
 *   • pdf-lib     – assembles the final recolored PDF
 *   • recolor.js  – pixel-level recoloring (ported from recolor.ts + sampling.ts)
 *   • bridge.js   – postMessage ↔ onMessage communication protocol
 *
 * Commands received (from Native → WebView via postMessage):
 *   { type: 'LOAD_PDF',         base64: string }
 *   { type: 'RENDER_PREVIEW',   pageNum, settings, palette }
 *   { type: 'EXPORT_DOCUMENT',  pages: number[], settings, palette }
 *   { type: 'CANCEL' }
 *
 * Messages sent (from WebView → Native via ReactNativeWebView.postMessage):
 *   { type: 'PDF_LOADED',        numPages }
 *   { type: 'PREVIEW_READY',     base64Image, pageNum }
 *   { type: 'PAGE_PROCESSED',    pageNum, totalPages, base64Page }
 *   { type: 'EXPORT_COMPLETE',   base64Pdf }
 *   { type: 'EXPORT_CANCELLED' }
 *   { type: 'ERROR',             message }
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const PROCESSOR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SoftPage Processor</title>
  <style>
    body { margin: 0; background: #000; overflow: hidden; }
    canvas { display: none; }
  </style>
</head>
<body>
<canvas id="offscreen"></canvas>

<script>
// ═══════════════════════════════════════════════════════════
// UTILITY: send message back to Native
// ═══════════════════════════════════════════════════════════
function postToNative(msg) {
  try {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else {
      // fallback for browser debugging
      window.parent.postMessage(JSON.stringify(msg), '*');
    }
  } catch(e) {
    console.error('postToNative error', e);
  }
}

// ═══════════════════════════════════════════════════════════
// RECOLORING ENGINE (ported from recolor.ts + sampling.ts)
// ═══════════════════════════════════════════════════════════

function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// Endianness check for Uint32Array RGBA/ABGR
const isLittleEndian = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;

function detectPhotoBlocks(imageData) {
  const blockSize = 16;
  const width  = imageData.width;
  const height = imageData.height;
  const data   = imageData.data;
  const blocksX = Math.ceil(width  / blockSize);
  const blocksY = Math.ceil(height / blockSize);

  // Use a 1D array for the mask to improve cache locality
  const mask = new Uint8Array(blocksX * blocksY);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const startX = bx * blockSize;
      const startY = by * blockSize;
      const endX   = Math.min(startX + blockSize, width);
      const endY   = Math.min(startY + blockSize, height);

      let totalSat = 0;
      let sumLum = 0;
      let sumSqLum = 0;
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          totalSat += max === 0 ? 0 : (max - min) / max;

          const lum = 0.299*r + 0.587*g + 0.114*b;
          sumLum += lum;
          sumSqLum += lum * lum;
          count++;
        }
      }

      const avgSat  = totalSat / count;
      const avgLum  = sumLum / count;
      // E[X^2] - (E[X])^2
      const variance = (sumSqLum / count) - (avgLum * avgLum);

      mask[by * blocksX + bx] = (avgSat > 0.15 && variance > 500) ? 1 : 0;
    }
  }
  return { mask, blocksX, blockSize };
}

function recolorImageData(imageData, palette, settings) {
  const { alreadyInverted, preserveImages, advanced } = settings;
  const { manualThreshold: threshold, brightness, contrast } = advanced;
  const width  = imageData.width;
  const height = imageData.height;

  let photoMaskInfo = null;
  if (preserveImages) {
    // Detect photo blocks *before* brightness/contrast to match original behavior
    photoMaskInfo = detectPhotoBlocks(imageData);
  }

  const bgColor = hexToRgb(palette.bg);
  const fgColor = hexToRgb(palette.fg);
  const result  = new ImageData(width, height);

  // Use Uint32Array for much faster pixel processing
  const src32 = new Uint32Array(imageData.data.buffer);
  const out32 = new Uint32Array(result.data.buffer);

  const len = src32.length;

  // Pre-calculate fixed background/foreground colors in ABGR (little endian)
  const bg32 = isLittleEndian
    ? (255 << 24) | (bgColor.b << 16) | (bgColor.g << 8) | bgColor.r
    : (bgColor.r << 24) | (bgColor.g << 16) | (bgColor.b << 8) | 255;

  const rBg = bgColor.r, gBg = bgColor.g, bBg = bgColor.b;
  const rDiff = fgColor.r - bgColor.r;
  const gDiff = fgColor.g - bgColor.g;
  const bDiff = fgColor.b - bgColor.b;

  const blocksX = photoMaskInfo ? photoMaskInfo.blocksX : 0;
  const mask = photoMaskInfo ? photoMaskInfo.mask : null;
  const blockSize = photoMaskInfo ? photoMaskInfo.blockSize : 16;
  const invThreshold = 255 - threshold;

  // Single pass optimization
  for (let i = 0; i < len; i++) {
    let px = src32[i];

    let r, g, b, a;
    if (isLittleEndian) {
      r = px & 0xFF;
      g = (px >> 8) & 0xFF;
      b = (px >> 16) & 0xFF;
      a = (px >> 24) & 0xFF;
    } else {
      r = (px >> 24) & 0xFF;
      g = (px >> 16) & 0xFF;
      b = (px >> 8) & 0xFF;
      a = px & 0xFF;
    }

    if (photoMaskInfo) {
      const pxX = i % width;
      const pxY = Math.floor(i / width);
      const bx = Math.floor(pxX / blockSize);
      const by = Math.floor(pxY / blockSize);
      if (mask[by * blocksX + bx] === 1) {
        // Output unchanged for photo blocks
        // We apply brightness/contrast *before* skipping photo blocks if they were applied
        if (brightness !== 0 || contrast !== 1.0) {
            let r2 = r, g2 = g, b2 = b;
            if (brightness !== 0) {
                r2 = Math.max(0, Math.min(255, r2 + brightness));
                g2 = Math.max(0, Math.min(255, g2 + brightness));
                b2 = Math.max(0, Math.min(255, b2 + brightness));
            }
            if (contrast !== 1.0) {
                r2 = Math.max(0, Math.min(255, (r2 - 128) * contrast + 128));
                g2 = Math.max(0, Math.min(255, (g2 - 128) * contrast + 128));
                b2 = Math.max(0, Math.min(255, (b2 - 128) * contrast + 128));
            }
            out32[i] = isLittleEndian
                ? (a << 24) | (Math.round(b2) << 16) | (Math.round(g2) << 8) | Math.round(r2)
                : (Math.round(r2) << 24) | (Math.round(g2) << 16) | (Math.round(b2) << 8) | a;
        } else {
            out32[i] = px;
        }
        continue;
      }
    }

    // Apply brightness and contrast in same pass
    if (brightness !== 0) {
      r = Math.max(0, Math.min(255, r + brightness));
      g = Math.max(0, Math.min(255, g + brightness));
      b = Math.max(0, Math.min(255, b + brightness));
    }
    if (contrast !== 1.0) {
      r = Math.max(0, Math.min(255, (r - 128) * contrast + 128));
      g = Math.max(0, Math.min(255, (g - 128) * contrast + 128));
      b = Math.max(0, Math.min(255, (b - 128) * contrast + 128));
    }

    let isBg;
    if (alreadyInverted) {
      isBg = r <= invThreshold && g <= invThreshold && b <= invThreshold;
    } else {
      isBg = r >= threshold && g >= threshold && b >= threshold;
    }

    if (isBg) {
      out32[i] = bg32;
    } else {
      const lum = (r + g + b) / 3;
      let darkness = alreadyInverted ? lum / 255 : 1 - (lum / threshold);
      if (darkness < 0) darkness = 0;
      else if (darkness > 1) darkness = 1;

      const outR = Math.round(rBg + rDiff * darkness);
      const outG = Math.round(gBg + gDiff * darkness);
      const outB = Math.round(bBg + bDiff * darkness);

      out32[i] = isLittleEndian
        ? (a << 24) | (outB << 16) | (outG << 8) | outR
        : (outR << 24) | (outG << 16) | (outB << 8) | a;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let pdfDoc     = null;
let pdfLib     = null;
let cancelled  = false;
let pdfjsReady = false;
let pdfLibReady = false;

// ═══════════════════════════════════════════════════════════
// LOAD SCRIPTS (CDN)
// ═══════════════════════════════════════════════════════════
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}

async function initLibs() {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    pdfjsReady = true;

    await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
    pdfLib = PDFLib;
    pdfLibReady = true;

    postToNative({ type: 'LIBS_READY' });
  } catch(e) {
    postToNative({ type: 'ERROR', message: 'Failed to load processing libraries: ' + e.message });
  }
}

// ═══════════════════════════════════════════════════════════
// PDF OPERATIONS
// ═══════════════════════════════════════════════════════════

async function loadPdf(base64) {
  try {
    if (!pdfjsReady) {
      postToNative({ type: 'ERROR', message: 'PDF library not yet loaded. Please check internet connection.' });
      return;
    }
    // Strip data URL prefix if present
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const loadTask = pdfjsLib.getDocument({
      data: bytes,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    pdfDoc = await loadTask.promise;
    postToNative({ type: 'PDF_LOADED', numPages: pdfDoc.numPages });
  } catch(e) {
    postToNative({ type: 'ERROR', message: 'Failed to load PDF: ' + e.message });
  }
}

async function renderPageToCanvas(pageNum, dpi) {
  const page     = await pdfDoc.getPage(pageNum);
  const scale    = dpi / 72;
  const viewport = page.getViewport({ scale });

  const canvas  = document.getElementById('offscreen');
  const ctx     = canvas.getContext('2d');
  canvas.width  = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function renderPreview(pageNum, settings, palette) {
  try {
    if (!pdfDoc) {
      postToNative({ type: 'ERROR', message: 'No PDF loaded' });
      return;
    }
    const canvas = await renderPageToCanvas(pageNum, settings.dpi);
    const ctx    = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const recolored = recolorImageData(imgData, palette, settings);
    ctx.putImageData(recolored, 0, 0);

    const base64Image = canvas.toDataURL('image/jpeg', 0.85);
    postToNative({ type: 'PREVIEW_READY', base64Image, pageNum });
  } catch(e) {
    postToNative({ type: 'ERROR', message: 'Preview failed: ' + e.message });
  }
}

async function exportDocument(pages, settings, palette) {
  try {
    if (!pdfDoc || !pdfLibReady) {
      postToNative({ type: 'ERROR', message: 'Not ready to export' });
      return;
    }
    cancelled = false;

    const { PDFDocument } = pdfLib;
    const newPdf = await PDFDocument.create();
    const total  = pages.length;

    for (let i = 0; i < pages.length; i++) {
      if (cancelled) {
        postToNative({ type: 'EXPORT_CANCELLED' });
        return;
      }

      const pageNum = pages[i];
      const canvas  = await renderPageToCanvas(pageNum, settings.dpi);
      const ctx     = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const recolored = recolorImageData(imgData, palette, settings);
      ctx.putImageData(recolored, 0, 0);

      // Convert canvas to PNG bytes efficiently via Blob -> ArrayBuffer
      const pngBytes = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          const reader = new FileReader();
          reader.onload = () => resolve(new Uint8Array(reader.result));
          reader.onerror = () => reject(new Error('FileReader error'));
          reader.readAsArrayBuffer(blob);
        }, 'image/png');
      });

      const img  = await newPdf.embedPng(pngBytes);
      const page = newPdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });

      if (cancelled) {
        postToNative({ type: 'EXPORT_CANCELLED' });
        return;
      }

      postToNative({ type: 'PAGE_PROCESSED', pageNum, totalPages: total });
    }

    if (cancelled) {
      postToNative({ type: 'EXPORT_CANCELLED' });
      return;
    }

    const pdfBytes  = await newPdf.save();

    // Chunking to avoid "Maximum call stack size exceeded" and OOM via massive string concatenation
    // Send it in chunks to React Native bridge directly
    // chunkSize must be a multiple of 3 (65535) to avoid internal Base64 padding characters ('=')
    const chunkSize = 65535;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      if (cancelled) {
        postToNative({ type: 'EXPORT_CANCELLED' });
        return;
      }
      const chunk = pdfBytes.subarray(i, i + chunkSize);

      // Convert chunk to string via manual loop instead of apply
      let binaryStr = '';
      for (let j = 0; j < chunk.length; j++) {
        binaryStr += String.fromCharCode(chunk[j]);
      }

      const base64Chunk = btoa(binaryStr);
      postToNative({ type: 'EXPORT_CHUNK', chunk: base64Chunk });
    }

    postToNative({ type: 'EXPORT_COMPLETE' });
  } catch(e) {
    postToNative({ type: 'ERROR', message: 'Export failed: ' + e.message });
  }
}

// ═══════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════
document.addEventListener('message', handleMessage);
window.addEventListener('message', handleMessage);

function handleMessage(event) {
  let cmd;
  try {
    cmd = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch(e) {
    return;
  }

  switch (cmd.type) {
    case 'LOAD_PDF':
      loadPdf(cmd.base64);
      break;
    case 'RENDER_PREVIEW':
      renderPreview(cmd.pageNum, cmd.settings, cmd.palette);
      break;
    case 'EXPORT_DOCUMENT':
      exportDocument(cmd.pages, cmd.settings, cmd.palette);
      break;
    case 'CANCEL':
      cancelled = true;
      break;
    default:
      console.warn('Unknown command:', cmd.type);
  }
}

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
initLibs();
</script>
</body>
</html>`;
