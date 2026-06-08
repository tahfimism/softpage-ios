import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

interface Props {
  base64Image: string | null;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export function PagePreview({
  base64Image,
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
}: Props) {
  const canGoBack = currentPage > 1;
  const canGoForward = currentPage < totalPages;

  return (
    <View style={s.container}>
      {/* Preview header */}
      <View style={s.header}>
        <Text style={s.headerLabel}>PREVIEW</Text>
        {totalPages > 0 && (
          <Text style={s.pageCount}>
            Page {currentPage} of {totalPages}
          </Text>
        )}
      </View>

      {/* Preview image area */}
      <View style={s.previewArea}>
        {isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#ff6b35" />
            <Text style={s.loadingText}>Rendering preview…</Text>
          </View>
        ) : base64Image ? (
          <Image
            source={{ uri: base64Image }}
            style={s.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📄</Text>
            <Text style={s.emptyText}>Load a PDF to see a preview</Text>
          </View>
        )}
      </View>

      {/* Page navigation */}
      {totalPages > 1 && (
        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.navBtn, !canGoBack && s.navBtnDisabled]}
            onPress={() => canGoBack && onPageChange(currentPage - 1)}
            disabled={!canGoBack}
          >
            <Text style={s.navBtnText}>‹ Prev</Text>
          </TouchableOpacity>

          <Text style={s.pageIndicator}>{currentPage} / {totalPages}</Text>

          <TouchableOpacity
            style={[s.navBtn, !canGoForward && s.navBtnDisabled]}
            onPress={() => canGoForward && onPageChange(currentPage + 1)}
            disabled={!canGoForward}
          >
            <Text style={s.navBtnText}>Next ›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#161616',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1.2,
  },
  pageCount: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  previewArea: {
    width: '100%',
    aspectRatio: 0.707, // A4 paper ratio
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    maxHeight: 440,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#202020',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navBtnText: {
    color: '#a0a0a0',
    fontSize: 14,
    fontWeight: '600',
  },
  pageIndicator: {
    color: '#666',
    fontSize: 13,
  },
});
