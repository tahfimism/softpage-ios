import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';

interface Props {
  visible: boolean;
  customBg: string;
  customFg: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function CustomPaletteModal({ visible, customBg, customFg, onClose, onSave }: Props) {
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name for your palette.');
      return;
    }
    onSave(trimmed);
    setName('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Save Palette</Text>

          {/* Preview */}
          <View style={styles.preview}>
            <View style={[styles.previewHalf, { backgroundColor: customBg }]}>
              <Text style={[styles.previewLabel, { color: customFg }]}>Aa</Text>
            </View>
            <View style={[styles.previewHalf, { backgroundColor: customFg }]}>
              <Text style={[styles.previewLabel, { color: customBg }]}>Aa</Text>
            </View>
          </View>

          <Text style={styles.hexRow}>
            BG: <Text style={styles.hexValue}>{customBg}</Text>{'   '}
            FG: <Text style={styles.hexValue}>{customFg}</Text>
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Palette name..."
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f0f0f0',
    marginBottom: 16,
  },
  preview: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewHalf: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 22,
    fontWeight: '700',
  },
  hexRow: {
    color: '#666',
    fontSize: 12,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  hexValue: {
    color: '#a0a0a0',
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    padding: 12,
    color: '#f0f0f0',
    fontSize: 15,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  cancelText: {
    color: '#a0a0a0',
    fontWeight: '600',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
  },
  saveText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});
