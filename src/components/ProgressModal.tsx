import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ProcessingState } from '../types';

interface Props {
  processing: ProcessingState;
  onCancel: () => void;
}

function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function ProgressModal({ processing, onCancel }: Props) {
  const { isProcessing, currentPage, totalPages, elapsedSeconds } = processing;
  const progress = totalPages > 0 ? currentPage / totalPages : 0;
  const pct = Math.round(progress * 100);

  return (
    <Modal
      visible={isProcessing}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <View style={s.dialog}>
          {/* Icon */}
          <ActivityIndicator size="large" color="#ff6b35" style={s.spinner} />

          <Text style={s.title}>Processing PDF</Text>
          <Text style={s.subtitle}>
            {totalPages > 0
              ? `Page ${currentPage} of ${totalPages}`
              : 'Preparing…'}
          </Text>

          {/* Progress bar */}
          <ProgressBar progress={progress} />

          {/* Stats row */}
          <View style={s.statsRow}>
            <Text style={s.stat}>{pct}%</Text>
            <Text style={s.stat}>
              {elapsedSeconds > 0 ? formatTime(elapsedSeconds) : '—'}
            </Text>
          </View>

          {/* Hint */}
          <Text style={s.hint}>
            Processing page-by-page to avoid memory issues.
          </Text>

          {/* Cancel */}
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelText}>Cancel (Esc)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f0f0f0',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 20,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff6b35',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  stat: {
    color: '#666',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: '#444',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#222',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelText: {
    color: '#a0a0a0',
    fontWeight: '600',
    fontSize: 14,
  },
});
