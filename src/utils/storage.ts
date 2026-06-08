import AsyncStorage from '@react-native-async-storage/async-storage';
import { Palette, BUILT_IN_PALETTES } from '../types';

const USER_PALETTES_KEY = 'softpage_user_palettes';
const LAST_SETTINGS_KEY = 'softpage_last_settings';

// ─── Palette Storage ───────────────────────────────────────────────────────

export async function getUserPalettes(): Promise<Palette[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_PALETTES_KEY);
    if (raw) {
      return JSON.parse(raw) as Palette[];
    }
  } catch (e) {
    console.warn('Failed to load user palettes:', e);
  }
  return [];
}

export async function getAllPalettes(): Promise<Palette[]> {
  const userPalettes = await getUserPalettes();
  return [...BUILT_IN_PALETTES, ...userPalettes];
}

export async function saveUserPalette(
  name: string,
  bg: string,
  fg: string
): Promise<Palette> {
  const userPalettes = await getUserPalettes();

  const newPalette: Palette = {
    id: `user-${Date.now()}`,
    name,
    bg,
    fg,
    isBuiltIn: false,
  };

  userPalettes.push(newPalette);

  try {
    await AsyncStorage.setItem(USER_PALETTES_KEY, JSON.stringify(userPalettes));
  } catch (e) {
    console.warn('Failed to save palette:', e);
  }

  return newPalette;
}

export async function deleteUserPalette(id: string): Promise<void> {
  const userPalettes = await getUserPalettes();
  const updated = userPalettes.filter((p) => p.id !== id);
  try {
    await AsyncStorage.setItem(USER_PALETTES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to delete palette:', e);
  }
}

// ─── Last Settings Storage ──────────────────────────────────────────────────

export async function saveLastSelectedPalettId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SETTINGS_KEY + '_palette', id);
  } catch (e) {
    console.warn('Failed to save last palette ID:', e);
  }
}

export async function getLastSelectedPaletteId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SETTINGS_KEY + '_palette');
  } catch (e) {
    console.warn('Failed to load last palette ID:', e);
    return null;
  }
}
