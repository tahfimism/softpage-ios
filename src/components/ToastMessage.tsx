import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ToastItem } from '../types';

interface SingleToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const COLORS: Record<ToastItem['type'], string> = {
  success: '#22c55e',
  error:   '#ef4444',
  info:    '#3b82f6',
  warning: '#f59e0b',
};

const ICONS: Record<ToastItem['type'], string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

function SingleToast({ toast, onDismiss }: SingleToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(() => onDismiss(toast.id));
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const color = COLORS[toast.type];
  const icon  = ICONS[toast.type];

  return (
    <Animated.View style={[s.toast, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.iconBadge, { backgroundColor: color + '22' }]}>
        <Text style={[s.icon, { color }]}>{icon}</Text>
      </View>
      <Text style={s.message} numberOfLines={2}>{toast.message}</Text>
      <TouchableOpacity onPress={() => onDismiss(toast.id)} style={s.closeBtn}>
        <Text style={s.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <View style={s.container} pointerEvents="box-none">
      {toasts.map((t) => (
        <SingleToast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    gap: 10,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    color: '#e0e0e0',
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: '#555',
    fontSize: 12,
  },
});
