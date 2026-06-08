import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Palette } from '../types';

interface Props {
  palettes: Palette[];
  selectedId: string;
  onSelect: (palette: Palette) => void;
  onDelete: (id: string) => void;
}

function PaletteChip({
  palette,
  isSelected,
  onSelect,
  onDelete,
}: {
  palette: Palette;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      onLongPress={onDelete}
      style={[styles.chip, isSelected && styles.chipSelected]}
      activeOpacity={0.75}
    >
      {/* Color preview swatches */}
      <View style={styles.swatches}>
        <View style={[styles.swatch, { backgroundColor: palette.bg, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
        <View style={[styles.swatch, { backgroundColor: palette.fg, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
      </View>

      <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]} numberOfLines={1}>
        {palette.name}
      </Text>

      {!palette.isBuiltIn && (
        <View style={styles.userBadge}>
          <Text style={styles.userBadgeText}>custom</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function PaletteSelector({ palettes, selectedId, onSelect, onDelete }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>COLOR PALETTE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {palettes.map((p) => (
          <PaletteChip
            key={p.id}
            palette={p}
            isSelected={p.id === selectedId}
            onSelect={() => onSelect(p)}
            onDelete={!p.isBuiltIn ? () => onDelete(p.id) : undefined}
          />
        ))}
      </ScrollView>
      {!palettes.find((p) => p.isBuiltIn === false) && (
        <Text style={styles.hint}>Long-press a custom palette to delete it</Text>
      )}
      {palettes.find((p) => p.isBuiltIn === false) && (
        <Text style={styles.hint}>Long-press a custom palette to delete</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1.2,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 10,
    paddingBottom: 4,
  },
  chip: {
    backgroundColor: '#161616',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 10,
    alignItems: 'center',
    minWidth: 90,
    maxWidth: 110,
  },
  chipSelected: {
    borderColor: '#ff6b35',
    backgroundColor: 'rgba(255,107,53,0.08)',
  },
  swatches: {
    flexDirection: 'row',
    width: 44,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 7,
    borderWidth: 1,
    borderColor: '#333',
  },
  swatch: {
    flex: 1,
  },
  chipLabel: {
    fontSize: 11,
    color: '#a0a0a0',
    textAlign: 'center',
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: '#ff6b35',
    fontWeight: '600',
  },
  userBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  userBadgeText: {
    fontSize: 9,
    color: '#ff6b35',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 11,
    color: '#444',
    paddingHorizontal: 16,
    marginTop: 6,
  },
});
