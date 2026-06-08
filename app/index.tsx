import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';

import { PROCESSOR_HTML } from '../src/core/processorHtml';
import { useWebViewBridge } from '../src/hooks/useWebViewBridge';
import { PaletteSelector } from '../src/components/PaletteSelector';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { PagePreview } from '../src/components/PagePreview';
import { ProgressModal } from '../src/components/ProgressModal';
import { CustomPaletteModal } from '../src/components/CustomPaletteModal';
import { ToastContainer } from '../src/components/ToastMessage';

import {
  Palette,
  Settings,
  ToastItem,
  BUILT_IN_PALETTES,
  createDefaultSettings,
} from '../src/types';
import {
  getAllPalettes,
  saveUserPalette,
  deleteUserPalette,
  saveLastSelectedPalettId,
  getLastSelectedPaletteId,
} from '../src/utils/storage';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeToastId() {
  return Date.now().toString();
}

function buildOutputFilename(original: string, suffix: string): string {
  const base = original.replace(/\.pdf$/i, '');
  return `${base}${suffix}.pdf`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [palettes, setPalettes] = useState<Palette[]>(BUILT_IN_PALETTES);
  const [selectedPalette, setSelectedPalette] = useState<Palette>(BUILT_IN_PALETTES[0]);
  const [customBg, setCustomBg] = useState(BUILT_IN_PALETTES[0].bg);
  const [customFg, setCustomFg] = useState(BUILT_IN_PALETTES[0].fg);
  const [settings, setSettings] = useState<Settings>(createDefaultSettings());
  const [currentPage, setCurrentPage] = useState(1);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showSavePaletteModal, setShowSavePaletteModal] = useState(false);

  // Preview debounce
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((type: ToastItem['type'], message: string) => {
    setToasts((prev) => [...prev, { id: makeToastId(), type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── WebView Bridge ─────────────────────────────────────────────────────────
  const onExportSuccess = useCallback(
    async (uri: string) => {
      addToast('success', 'PDF processed! Opening share sheet…');
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save or share your recolored PDF',
            UTI: 'com.adobe.pdf',
          });
        } else {
          addToast('info', `PDF saved to: ${uri}`);
        }
      } catch (e: any) {
        addToast('error', 'Sharing failed: ' + e.message);
      }
    },
    [addToast]
  );

  const onError = useCallback(
    (msg: string) => {
      addToast('error', msg);
      setIsPreviewLoading(false);
    },
    [addToast]
  );

  const bridge = useWebViewBridge(onError, onExportSuccess);

  // Wrap bridge.handleMessage to also handle preview loading state
  const handleWebViewMessage = useCallback(
    (event: any) => {
      const raw = event.nativeEvent.data;
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.type === 'PDF_LOADED') {
        bridge.handleMessage(event);
        setPdfLoaded(true);
        setCurrentPage(1);
        addToast('success', `Loaded PDF (${msg.numPages} pages)`);
        setIsPreviewLoading(false);
      } else if (msg.type === 'PREVIEW_READY') {
        setIsPreviewLoading(false);
        bridge.handleMessage(event);
      } else if (msg.type === 'ERROR') {
        setIsPreviewLoading(false);
        bridge.handleMessage(event);
      } else {
        bridge.handleMessage(event);
      }
    },
    [bridge, addToast]
  );

  // ── Load palettes on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const all = await getAllPalettes();
      setPalettes(all);
      const lastId = await getLastSelectedPaletteId();
      if (lastId) {
        const found = all.find((p) => p.id === lastId);
        if (found) {
          setSelectedPalette(found);
          setCustomBg(found.bg);
          setCustomFg(found.fg);
        }
      }
    })();
  }, []);

  // ── Current palette (with custom color overrides) ──────────────────────────
  const currentPalette: Palette = {
    ...selectedPalette,
    bg: customBg,
    fg: customFg,
  };

  // ── Trigger preview (debounced, 400ms) ─────────────────────────────────────
  const triggerPreview = useCallback(() => {
    if (!pdfLoaded || !bridge.libsReady) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setIsPreviewLoading(true);
    previewTimerRef.current = setTimeout(() => {
      bridge.renderPreview(currentPage, settings, currentPalette);
    }, 400);
  }, [pdfLoaded, bridge, currentPage, settings, currentPalette]);

  useEffect(() => {
    triggerPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, settings, customBg, customFg, selectedPalette]);

  // ── File Picker ────────────────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      // SDK 54+: result.assets array
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        addToast('error', 'Could not read the selected file.');
        return;
      }

      setFileName(asset.name);
      setPdfLoaded(false);
      bridge.reset();
      setCurrentPage(1);
      setIsPreviewLoading(true);
      addToast('info', `Loading "${asset.name}"…`);

      // Read file as Base64 using the legacy API (consistent with useWebViewBridge write)
      const base64 = await readAsStringAsync(asset.uri, { encoding: 'base64' });

      bridge.loadPdf(base64);
    } catch (e: any) {
      addToast('error', 'Failed to pick file: ' + e.message);
      setIsPreviewLoading(false);
    }
  }, [bridge, addToast]);


  // ── Clear ──────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    Alert.alert('Clear PDF', 'Remove the current document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          bridge.reset();
          setPdfLoaded(false);
          setFileName(null);
          setCurrentPage(1);
        },
      },
    ]);
  }, [bridge]);

  // ── Palette management ─────────────────────────────────────────────────────
  const handleSelectPalette = useCallback(
    async (palette: Palette) => {
      setSelectedPalette(palette);
      setCustomBg(palette.bg);
      setCustomFg(palette.fg);
      await saveLastSelectedPalettId(palette.id);
    },
    []
  );

  const handleSavePalette = useCallback(
    async (name: string) => {
      const saved = await saveUserPalette(name, customBg, customFg);
      const updated = await getAllPalettes();
      setPalettes(updated);
      setSelectedPalette(saved);
      addToast('success', `Saved palette "${name}"`);
    },
    [customBg, customFg, addToast]
  );

  const handleDeletePalette = useCallback(
    async (id: string) => {
      Alert.alert('Delete Palette', 'Delete this custom palette?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteUserPalette(id);
            const updated = await getAllPalettes();
            setPalettes(updated);
            if (selectedPalette.id === id) {
              setSelectedPalette(BUILT_IN_PALETTES[0]);
              setCustomBg(BUILT_IN_PALETTES[0].bg);
              setCustomFg(BUILT_IN_PALETTES[0].fg);
            }
            addToast('info', 'Palette deleted');
          },
        },
      ]);
    },
    [selectedPalette, addToast]
  );

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExportAll = useCallback(() => {
    if (!pdfLoaded || bridge.numPages === 0) {
      addToast('error', 'Please load a PDF first');
      return;
    }
    const pages = Array.from({ length: bridge.numPages }, (_, i) => i + 1);
    const outName = buildOutputFilename(fileName ?? 'document', '_recolored');
    bridge.exportDocument(pages, settings, currentPalette, outName);
  }, [pdfLoaded, bridge, fileName, settings, currentPalette, addToast]);

  const handleExportCurrentPage = useCallback(() => {
    if (!pdfLoaded) {
      addToast('error', 'Please load a PDF first');
      return;
    }
    const outName = buildOutputFilename(fileName ?? 'document', `_page${currentPage}`);
    bridge.exportDocument([currentPage], settings, currentPalette, outName);
  }, [pdfLoaded, bridge, currentPage, fileName, settings, currentPalette, addToast]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* ── Hidden WebView (PDF processing engine) ── */}
      <WebView
        ref={bridge.webViewRef}
        source={{ html: PROCESSOR_HTML }}
        style={s.hiddenWebView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        originWhitelist={['*']}
        mixedContentMode="always"
        onError={(e) => addToast('error', 'WebView error: ' + e.nativeEvent.description)}
      />

      {/* ── Main scrollable content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.heroTitle}>
              Recolor your{' '}
              <Text style={s.heroAccent}>PDFs</Text>
            </Text>
            <Text style={s.heroSub}>
              100% on-device — your files never leave your phone.
            </Text>
          </View>
          <TouchableOpacity
            style={s.aboutBtn}
            onPress={() => router.push('/about')}
          >
            <Text style={s.aboutBtnText}>?</Text>
          </TouchableOpacity>
        </View>

        {/* ── File Picker card ── */}
        <View style={s.card}>
          {!pdfLoaded ? (
            <TouchableOpacity style={s.dropZone} onPress={handlePickFile} activeOpacity={0.7}>
              <Text style={s.dropIcon}>📄</Text>
              <Text style={s.dropTitle}>Tap to Select PDF</Text>
              <Text style={s.dropSub}>
                Opens the Files app — iCloud, On My iPhone, and more
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={s.fileRow}>
              <View style={s.fileIconBox}>
                <Text style={s.fileIcon}>📄</Text>
              </View>
              <View style={s.fileInfo}>
                <Text style={s.fileName} numberOfLines={1}>{fileName}</Text>
                <Text style={s.fileMeta}>
                  {bridge.numPages} page{bridge.numPages !== 1 ? 's' : ''}
                  {bridge.libsReady ? '' : '  · Loading engine…'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClear} style={s.clearBtn}>
                <Text style={s.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Page Preview ── */}
        <PagePreview
          base64Image={bridge.previewBase64}
          currentPage={currentPage}
          totalPages={bridge.numPages}
          isLoading={isPreviewLoading}
          onPageChange={setCurrentPage}
        />

        {/* ── Palette Selector ── */}
        <View style={s.section}>
          <PaletteSelector
            palettes={palettes}
            selectedId={selectedPalette.id}
            onSelect={handleSelectPalette}
            onDelete={handleDeletePalette}
          />
        </View>

        {/* ── Custom Color Pickers ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>CUSTOM COLORS</Text>
          <View style={s.colorRow}>
            {/* Background Color */}
            <View style={s.colorItem}>
              <Text style={s.colorLabel}>Background</Text>
              <View style={[s.colorSwatch, { backgroundColor: customBg }]}>
                <Text style={[s.colorHex, { color: customFg }]}>{customBg}</Text>
              </View>
            </View>
            {/* Foreground Color */}
            <View style={s.colorItem}>
              <Text style={s.colorLabel}>Text / Ink</Text>
              <View style={[s.colorSwatch, { backgroundColor: customFg }]}>
                <Text style={[s.colorHex, { color: customBg }]}>{customFg}</Text>
              </View>
            </View>
          </View>
          <Text style={s.colorHint}>
            To use custom colors, select a palette then tap a color to modify it via the edit button below.
          </Text>
          <TouchableOpacity
            style={s.saveCustomBtn}
            onPress={() => setShowSavePaletteModal(true)}
          >
            <Text style={s.saveCustomBtnText}>+ Save Current as Palette</Text>
          </TouchableOpacity>
        </View>

        {/* ── Settings ── */}
        <SettingsPanel settings={settings} onChange={setSettings} />

        {/* ── Export Buttons ── */}
        <View style={s.exportSection}>
          <TouchableOpacity
            style={[s.exportBtn, s.exportBtnPrimary, !pdfLoaded && s.exportBtnDisabled]}
            onPress={handleExportAll}
            disabled={!pdfLoaded || bridge.processing.isProcessing}
            activeOpacity={0.8}
          >
            <Text style={s.exportBtnPrimaryText}>
              ↓ Process & Export All Pages
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.exportBtn, s.exportBtnSecondary, !pdfLoaded && s.exportBtnDisabled]}
            onPress={handleExportCurrentPage}
            disabled={!pdfLoaded || bridge.processing.isProcessing}
            activeOpacity={0.8}
          >
            <Text style={s.exportBtnSecondaryText}>
              Current Page Only
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Bottom padding ── */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Progress Modal ── */}
      <ProgressModal processing={bridge.processing} onCancel={bridge.cancelExport} />

      {/* ── Save Palette Modal ── */}
      <CustomPaletteModal
        visible={showSavePaletteModal}
        customBg={customBg}
        customFg={customFg}
        onClose={() => setShowSavePaletteModal(false)}
        onSave={handleSavePalette}
      />

      {/* ── Toasts ── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  hiddenWebView: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f0f0f0',
    letterSpacing: -0.5,
  },
  heroAccent: {
    color: '#ff6b35',
  },
  heroSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  aboutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  aboutBtnText: {
    color: '#666',
    fontWeight: '700',
    fontSize: 15,
  },

  // Card
  card: {
    backgroundColor: '#161616',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Drop zone
  dropZone: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  dropIcon: {
    fontSize: 44,
    marginBottom: 4,
  },
  dropTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e0e0e0',
  },
  dropSub: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },

  // Loaded file row
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,53,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIcon: {
    fontSize: 22,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#e0e0e0',
    fontWeight: '600',
    fontSize: 14,
  },
  fileMeta: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#666',
    fontWeight: '700',
    fontSize: 13,
  },

  // Section wrapper
  section: {},

  // Color pickers (display-only)
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  colorItem: {
    flex: 1,
  },
  colorLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    fontWeight: '600',
  },
  colorSwatch: {
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  colorHex: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  colorHint: {
    color: '#555',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  saveCustomBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff6b35',
    alignItems: 'center',
  },
  saveCustomBtnText: {
    color: '#ff6b35',
    fontWeight: '600',
    fontSize: 13,
  },

  // Export buttons
  exportSection: {
    gap: 10,
    marginTop: 6,
  },
  exportBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnPrimary: {
    backgroundColor: '#ff6b35',
  },
  exportBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333',
  },
  exportBtnDisabled: {
    opacity: 0.4,
  },
  exportBtnPrimaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  exportBtnSecondaryText: {
    color: '#a0a0a0',
    fontSize: 15,
    fontWeight: '600',
  },
});
