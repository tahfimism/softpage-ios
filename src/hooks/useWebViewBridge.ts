import { useRef, useCallback, useState } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  NativeMessage,
  WebViewCommand,
  Palette,
  Settings,
  ProcessingState,
} from '../types';

export interface WebViewBridgeResult {
  webViewRef: React.RefObject<WebView>;
  libsReady: boolean;
  numPages: number;
  processing: ProcessingState;
  previewBase64: string | null;
  sendCommand: (cmd: WebViewCommand) => void;
  handleMessage: (event: WebViewMessageEvent) => void;
  loadPdf: (base64: string) => void;
  renderPreview: (pageNum: number, settings: Settings, palette: Palette) => void;
  exportDocument: (
    pages: number[],
    settings: Settings,
    palette: Palette,
    filename: string
  ) => void;
  cancelExport: () => void;
  reset: () => void;
}

export function useWebViewBridge(
  onError: (msg: string) => void,
  onExportSuccess: (uri: string) => void
): WebViewBridgeResult {
  const webViewRef = useRef<WebView>(null);
  const [libsReady, setLibsReady] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    currentPage: 0,
    totalPages: 0,
    elapsedSeconds: 0,
    isCancelled: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pendingFilenameRef = useRef<string>('output_recolored.pdf');
  const pendingPagesCountRef = useRef<number>(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setProcessing((prev) => ({ ...prev, elapsedSeconds: elapsed }));
    }, 1000);
  }, [stopTimer]);

  const sendCommand = useCallback((cmd: WebViewCommand) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(cmd));
    }
  }, []);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: NativeMessage & { type: string };
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'LIBS_READY':
          setLibsReady(true);
          break;

        case 'PDF_LOADED':
          setNumPages((msg as any).numPages);
          break;

        case 'PREVIEW_READY':
          setPreviewBase64((msg as any).base64Image);
          break;

        case 'PAGE_PROCESSED': {
          const { pageNum, totalPages } = msg as any;
          setProcessing((prev) => ({
            ...prev,
            currentPage: pageNum,
            totalPages,
          }));
          break;
        }

        case 'EXPORT_COMPLETE': {
          stopTimer();
          const { base64Pdf } = msg as any;

          // Write base64 PDF to device temp storage
          const fileUri =
            FileSystem.cacheDirectory + pendingFilenameRef.current;
          try {
            await FileSystem.writeAsStringAsync(fileUri, base64Pdf, {
              encoding: FileSystem.EncodingType.Base64,
            });
            setProcessing((prev) => ({
              ...prev,
              isProcessing: false,
              currentPage: prev.totalPages,
            }));
            onExportSuccess(fileUri);
          } catch (e: any) {
            onError('Failed to save PDF: ' + e.message);
            setProcessing((prev) => ({ ...prev, isProcessing: false }));
          }
          break;
        }

        case 'EXPORT_CANCELLED':
          stopTimer();
          setProcessing({
            isProcessing: false,
            currentPage: 0,
            totalPages: 0,
            elapsedSeconds: 0,
            isCancelled: true,
          });
          break;

        case 'ERROR':
          stopTimer();
          setProcessing((prev) => ({ ...prev, isProcessing: false }));
          onError((msg as any).message ?? 'Unknown error');
          break;

        default:
          break;
      }
    },
    [onError, onExportSuccess, stopTimer]
  );

  const loadPdf = useCallback(
    (base64: string) => {
      sendCommand({ type: 'LOAD_PDF', base64 });
    },
    [sendCommand]
  );

  const renderPreview = useCallback(
    (pageNum: number, settings: Settings, palette: Palette) => {
      if (!libsReady) return;
      sendCommand({ type: 'RENDER_PREVIEW', pageNum, settings, palette });
    },
    [libsReady, sendCommand]
  );

  const exportDocument = useCallback(
    (pages: number[], settings: Settings, palette: Palette, filename: string) => {
      if (!libsReady) {
        onError('Processing engine not ready yet. Please wait.');
        return;
      }
      pendingFilenameRef.current = filename;
      pendingPagesCountRef.current = pages.length;
      setProcessing({
        isProcessing: true,
        currentPage: 0,
        totalPages: pages.length,
        elapsedSeconds: 0,
        isCancelled: false,
      });
      startTimer();
      sendCommand({ type: 'EXPORT_DOCUMENT', pages, settings, palette });
    },
    [libsReady, sendCommand, startTimer, onError]
  );

  const cancelExport = useCallback(() => {
    sendCommand({ type: 'CANCEL' });
    stopTimer();
    setProcessing((prev) => ({
      ...prev,
      isProcessing: false,
      isCancelled: true,
    }));
  }, [sendCommand, stopTimer]);

  const reset = useCallback(() => {
    setNumPages(0);
    setPreviewBase64(null);
    setProcessing({
      isProcessing: false,
      currentPage: 0,
      totalPages: 0,
      elapsedSeconds: 0,
      isCancelled: false,
    });
  }, []);

  return {
    webViewRef,
    libsReady,
    numPages,
    processing,
    previewBase64,
    sendCommand,
    handleMessage,
    loadPdf,
    renderPreview,
    exportDocument,
    cancelExport,
    reset,
  };
}
