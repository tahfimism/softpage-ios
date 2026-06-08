// ─────────────────────────────────────────────
// Palette & Settings
// ─────────────────────────────────────────────

export interface Palette {
  id: string;
  name: string;
  bg: string;
  fg: string;
  isBuiltIn?: boolean;
}

export interface AdvancedSettings {
  manualThreshold: number; // 180–250
  brightness: number; // -50 to +50
  contrast: number; // 0.5 to 1.8
}

export interface Settings {
  dpi: number; // 72–300
  alreadyInverted: boolean;
  preserveImages: boolean;
  advanced: AdvancedSettings;
}

export const createDefaultSettings = (): Settings => ({
  dpi: 150,
  alreadyInverted: false,
  preserveImages: false,
  advanced: {
    manualThreshold: 220,
    brightness: 0,
    contrast: 1.0,
  },
});

// ─────────────────────────────────────────────
// Processing state
// ─────────────────────────────────────────────

export interface ProcessingState {
  isProcessing: boolean;
  currentPage: number;
  totalPages: number;
  elapsedSeconds: number;
  isCancelled: boolean;
}

// ─────────────────────────────────────────────
// WebView messages (Native → WebView)
// ─────────────────────────────────────────────

export type WebViewCommandType =
  | 'LOAD_PDF'
  | 'RENDER_PREVIEW'
  | 'EXPORT_DOCUMENT'
  | 'CANCEL';

export interface LoadPdfCommand {
  type: 'LOAD_PDF';
  base64: string; // base64-encoded PDF bytes
}

export interface RenderPreviewCommand {
  type: 'RENDER_PREVIEW';
  pageNum: number;
  settings: Settings;
  palette: Palette;
}

export interface ExportDocumentCommand {
  type: 'EXPORT_DOCUMENT';
  pages: number[]; // array of page numbers to process
  settings: Settings;
  palette: Palette;
}

export interface CancelCommand {
  type: 'CANCEL';
}

export type WebViewCommand =
  | LoadPdfCommand
  | RenderPreviewCommand
  | ExportDocumentCommand
  | CancelCommand;

// ─────────────────────────────────────────────
// WebView messages (WebView → Native)
// ─────────────────────────────────────────────

export type NativeMessageType =
  | 'LIBS_READY'
  | 'PDF_LOADED'
  | 'PREVIEW_READY'
  | 'PAGE_PROCESSED'
  | 'EXPORT_CHUNK'
  | 'EXPORT_COMPLETE'
  | 'EXPORT_CANCELLED'
  | 'ERROR';

export interface LibsReadyMessage {
  type: 'LIBS_READY';
}

export interface PdfLoadedMessage {
  type: 'PDF_LOADED';
  numPages: number;
}

export interface PreviewReadyMessage {
  type: 'PREVIEW_READY';
  base64Image: string; // data URL png
  pageNum: number;
}

export interface PageProcessedMessage {
  type: 'PAGE_PROCESSED';
  pageNum: number;
  totalPages: number;
  base64Page: string; // base64-encoded PNG blob for this page
}

export interface ExportChunkMessage {
  type: 'EXPORT_CHUNK';
  chunk: string; // base64-encoded PDF chunk
}

export interface ExportCompleteMessage {
  type: 'EXPORT_COMPLETE';
}

export interface ExportCancelledMessage {
  type: 'EXPORT_CANCELLED';
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

export type NativeMessage =
  | LibsReadyMessage
  | PdfLoadedMessage
  | PreviewReadyMessage
  | PageProcessedMessage
  | ExportChunkMessage
  | ExportCompleteMessage
  | ExportCancelledMessage
  | ErrorMessage;

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// ─────────────────────────────────────────────
// Built-in palettes
// ─────────────────────────────────────────────

export const BUILT_IN_PALETTES: Palette[] = [
  { id: 'classic-dark', name: 'Classic Dark', bg: '#0f0f10', fg: '#e9e9ea', isBuiltIn: true },
  { id: 'warm-sepia', name: 'Warm Sepia', bg: '#f4ecd8', fg: '#2a1d12', isBuiltIn: true },
  { id: 'soft-gray', name: 'Soft Gray', bg: '#f2f3f5', fg: '#202225', isBuiltIn: true },
  { id: 'night-blue', name: 'Night Blue', bg: '#0b1220', fg: '#d7e3ff', isBuiltIn: true },
  { id: 'cream-ink', name: 'Cream + Ink', bg: '#fff7e6', fg: '#10131a', isBuiltIn: true },
  { id: 'pure-bw', name: 'Pure B/W', bg: '#ffffff', fg: '#000000', isBuiltIn: true },
  { id: 'amoled', name: 'AMOLED', bg: '#000000', fg: '#ffffff', isBuiltIn: true },
  { id: 'low-glare-green', name: 'Low-glare Green', bg: '#0b1a12', fg: '#d6ffe6', isBuiltIn: true },
];
