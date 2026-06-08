import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  LayoutAnimation,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings } from '../types';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onValueChange: (v: number) => void;
}) {
  return (
    <View style={s.sliderRow}>
      <View style={s.sliderHeader}>
        <Text style={s.sliderLabel}>{label}</Text>
        <Text style={s.sliderValue}>{displayValue}</Text>
      </View>
      <Slider
        style={s.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="#ff6b35"
        maximumTrackTintColor="#2a2a2a"
        thumbTintColor="#ff6b35"
      />
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleText}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#2a2a2a', true: 'rgba(255,107,53,0.45)' }}
        thumbColor={value ? '#ff6b35' : '#555'}
        ios_backgroundColor="#2a2a2a"
      />
    </View>
  );
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (partial: Partial<Settings>) =>
    onChange({ ...settings, ...partial });

  const updateAdv = (partial: Partial<Settings['advanced']>) =>
    update({ advanced: { ...settings.advanced, ...partial } });

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((v) => !v);
  };

  return (
    <View style={s.container}>
      {/* ─── Toggles ─── */}
      <Text style={s.sectionTitle}>OPTIONS</Text>
      <View style={s.card}>
        <ToggleRow
          label="Already Inverted"
          description="PDF text is light-on-dark already"
          value={settings.alreadyInverted}
          onToggle={(v) => update({ alreadyInverted: v })}
        />
        <View style={s.divider} />
        <ToggleRow
          label="Preserve Images"
          description="Keep colorful photo blocks unchanged"
          value={settings.preserveImages}
          onToggle={(v) => update({ preserveImages: v })}
        />
      </View>

      {/* ─── Output DPI ─── */}
      <View style={s.card}>
        <LabeledSlider
          label="Output DPI"
          value={settings.dpi}
          min={72}
          max={300}
          step={12}
          displayValue={`${settings.dpi} dpi`}
          onValueChange={(v) => update({ dpi: v })}
        />
        <Text style={s.dpiHint}>
          {settings.dpi <= 120
            ? 'Fast · Low quality'
            : settings.dpi <= 192
            ? 'Balanced'
            : 'Slow · High quality'}
        </Text>
      </View>

      {/* ─── Advanced toggle ─── */}
      <TouchableOpacity
        style={s.advancedToggle}
        onPress={toggleAdvanced}
        activeOpacity={0.7}
      >
        <Text style={s.advancedToggleLabel}>Advanced Settings</Text>
        <Text style={s.advancedChevron}>{advancedOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {advancedOpen && (
        <View style={s.card}>
          <LabeledSlider
            label="Threshold"
            value={settings.advanced.manualThreshold}
            min={180}
            max={250}
            step={1}
            displayValue={`${settings.advanced.manualThreshold}`}
            onValueChange={(v) => updateAdv({ manualThreshold: v })}
          />
          <View style={s.divider} />
          <LabeledSlider
            label="Brightness"
            value={settings.advanced.brightness}
            min={-50}
            max={50}
            step={1}
            displayValue={
              settings.advanced.brightness > 0
                ? `+${settings.advanced.brightness}`
                : `${settings.advanced.brightness}`
            }
            onValueChange={(v) => updateAdv({ brightness: v })}
          />
          <View style={s.divider} />
          <LabeledSlider
            label="Contrast"
            value={settings.advanced.contrast}
            min={0.5}
            max={1.8}
            step={0.05}
            displayValue={settings.advanced.contrast.toFixed(2)}
            onValueChange={(v) => updateAdv({ contrast: v })}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#161616',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleText: { flex: 1, paddingRight: 12 },
  toggleLabel: { color: '#e0e0e0', fontSize: 14, fontWeight: '600' },
  toggleDesc: { color: '#666', fontSize: 12, marginTop: 2 },
  sliderRow: {
    paddingVertical: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderLabel: { color: '#e0e0e0', fontSize: 14, fontWeight: '600' },
  sliderValue: {
    color: '#ff6b35',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  slider: { width: '100%', height: 36 },
  dpiHint: {
    color: '#555',
    fontSize: 11,
    textAlign: 'right',
    marginTop: -8,
    paddingBottom: 4,
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  advancedToggleLabel: {
    color: '#a0a0a0',
    fontSize: 13,
    fontWeight: '600',
  },
  advancedChevron: { color: '#666', fontSize: 11 },
});
