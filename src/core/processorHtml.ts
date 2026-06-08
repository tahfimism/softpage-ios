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

function applyBrightness(data, amount) {
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.max(0, Math.min(255, data[i]   + amount));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + amount));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + amount));
  }
}

function applyContrast(data, factor) {
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.max(0, Math.min(255, (data[i]   - 128) * factor + 128));
    data[i+1] = Math.max(0, Math.min(255, (data[i+1] - 128) * factor + 128));
    data[i+2] = Math.max(0, Math.min(255, (data[i+2] - 128) * factor + 128));
  }
}

function detectPhotoBlocks(imageData) {
  const blockSize = 16;
  const width  = imageData.width;
  const height = imageData.height;
  const data   = imageData.data;
  const blocksX = Math.ceil(width  / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  const mask = [];

  for (let by = 0; by < blocksY; by++) {
    mask[by] = [];
    for (let bx = 0; bx < blocksX; bx++) {
      const startX = bx * blockSize;
      const startY = by * blockSize;
      const endX   = Math.min(startX + blockSize, width);
      const endY   = Math.min(startY + blockSize, height);

      let totalSat = 0;
      const lums = [];
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          totalSat += max === 0 ? 0 : (max - min) / max;
          lums.push(0.299*r + 0.587*g + 0.114*b);
          count++;
        }
      }

      const avgSat  = totalSat / count;
      const avgLum  = lums.reduce((a,b) => a+b, 0) / lums.length;
      const variance = lums.reduce((s,l) => s + Math.pow(l - avgLum, 2), 0) / lums.length;
      mask[by][bx] = avgSat > 0.15 && variance > 500;
    }
  }
  return mask;
}

function isInPhotoBlock(x, y, mask, blockSize = 16) {
  const by = Math.floor(y / blockSize);
  const bx = Math.floor(x / blockSize);
  return mask[by] && mask[by][bx] !== undefined ? mask[by][bx] : false;
}

function recolorImageData(imageData, palette, settings) {
  const { alreadyInverted, preserveImages, advanced } = settings;
  const { manualThreshold: threshold, brightness, contrast } = advanced;
  const width  = imageData.width;
  const height = imageData.height;

  // Copy data
  const srcData = new Uint8ClampedArray(imageData.data);

  if (brightness !== 0) applyBrightness(srcData, brightness);
  if (contrast !== 1.0)  applyContrast(srcData,   contrast);

  let photoMask = null;
  if (preserveImages) {
    const tmp = new ImageData(new Uint8ClampedArray(srcData), width, height);
    photoMask = detectPhotoBlocks(tmp);
  }

  const bgColor = hexToRgb(palette.bg);
  const fgColor = hexToRgb(palette.fg);
  const result  = new ImageData(width, height);
  const out     = result.data;

  for (let i = 0; i < srcData.length; i += 4) {
    const r = srcData[i], g = srcData[i+1], b = srcData[i+2], a = srcData[i+3];

    if (photoMask) {
      const pi = i / 4;
      const px = pi % width;
      const py = Math.floor(pi / width);
      if (isInPhotoBlock(px, py, photoMask)) {
        out[i] = r; out[i+1] = g; out[i+2] = b; out[i+3] = a;
        continue;
      }
    }

    let isBg;
    if (alreadyInverted) {
      const inv = 255 - threshold;
      isBg = r <= inv && g <= inv && b <= inv;
    } else {
      isBg = r >= threshold && g >= threshold && b >= threshold;
    }

    if (isBg) {
      out[i] = bgColor.r; out[i+1] = bgColor.g; out[i+2] = bgColor.b;
    } else {
      const lum = (r + g + b) / 3;
      let darkness = alreadyInverted ? lum / 255 : 1 - (lum / threshold);
      darkness = Math.max(0, Math.min(1, darkness));
      out[i]   = Math.round(bgColor.r + (fgColor.r - bgColor.r) * darkness);
      out[i+1] = Math.round(bgColor.g + (fgColor.g - bgColor.g) * darkness);
      out[i+2] = Math.round(bgColor.b + (fgColor.b - bgColor.b) * darkness);
    }
    out[i+3] = a;
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

      // Convert canvas to PNG bytes
      const dataUrl = canvas.toDataURL('image/png');
      const pngData = dataUrl.split(',')[1];
      const pngBytes = Uint8Array.from(atob(pngData), c => c.charCodeAt(0));

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
