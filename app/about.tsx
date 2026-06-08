import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  TouchableOpacity,
} from 'react-native';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={s.body}>{children}</Text>;
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={s.featureRow}>
      <Text style={s.featureIcon}>{icon}</Text>
      <View style={s.featureText}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export default function AboutScreen() {
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Logo / tagline */}
      <View style={s.hero}>
        <Text style={s.logoIcon}>📄</Text>
        <Text style={s.logoName}>
          Soft<Text style={s.logoAccent}>Page</Text>
        </Text>
        <Text style={s.logoVersion}>Version 1.0</Text>
        <Text style={s.tagline}>
          Beautiful PDF recoloring, entirely on your device.
        </Text>
      </View>

      {/* What it does */}
      <Section title="WHAT IT DOES">
        <Body>
          SoftPage recolors PDF documents to be easier on your eyes. Whether
          you prefer a dark mode, a warm sepia tone, or a custom color scheme,
          SoftPage applies your chosen palette to every page of your PDF.
        </Body>
        <View style={s.featureList}>
          <FeatureRow icon="🎨" title="8 Built-in Palettes" desc="Classic Dark, Warm Sepia, Night Blue, AMOLED, and more" />
          <FeatureRow icon="💾" title="Custom Palettes" desc="Create and save your own background + text color combos" />
          <FeatureRow icon="🖼" title="Preserve Images" desc="Detects and leaves photo blocks untouched" />
          <FeatureRow icon="⚡" title="On-Device Processing" desc="No cloud uploads — your PDF never leaves your phone" />
          <FeatureRow icon="📤" title="Native iOS Sharing" desc="Save to Files, AirDrop, email, and more" />
        </View>
      </Section>

      {/* How it works */}
      <Section title="HOW IT WORKS">
        <Body>
          SoftPage uses pdf.js to render each page of your PDF to a high-resolution
          image, then applies a threshold-based pixel recoloring algorithm to classify
          each pixel as either background or ink, and maps it to your chosen palette.
        </Body>
        <Body>
          The processed pages are then assembled back into a new PDF using pdf-lib.
          Everything runs locally in an isolated sandboxed browser environment inside
          the app — no server ever touches your files.
        </Body>
      </Section>

      {/* Tips */}
      <Section title="TIPS">
        <View style={s.tipList}>
          {[
            'Higher DPI = sharper output but slower processing',
            'Use "Already Inverted" if your PDF has white text on dark background',
            '"Preserve Images" detects colorful regions and skips recoloring them',
            'Increase the Threshold if too much content is being treated as ink',
            'Save your favorite color combos as custom palettes for reuse',
          ].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={s.tipBullet}>•</Text>
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </Section>

      {/* Privacy */}
      <Section title="PRIVACY">
        <View style={s.privacyBadge}>
          <Text style={s.privacyIcon}>🔒</Text>
          <Text style={s.privacyText}>
            SoftPage never collects, transmits, or stores any of your data.
            Your PDFs are processed entirely on your device and are never
            sent to any server. The only network request made is to load
            the open-source pdf.js and pdf-lib libraries from a CDN.
          </Text>
        </View>
      </Section>

      {/* Credits */}
      <Section title="OPEN SOURCE CREDITS">
        <Body>
          SoftPage is built with the following open-source libraries:
        </Body>
        <View style={s.creditList}>
          {[
            { name: 'pdf.js by Mozilla', url: 'https://mozilla.github.io/pdf.js/' },
            { name: 'pdf-lib', url: 'https://pdf-lib.js.org/' },
            { name: 'React Native', url: 'https://reactnative.dev/' },
            { name: 'Expo', url: 'https://expo.dev/' },
          ].map((c) => (
            <TouchableOpacity key={c.name} onPress={() => Linking.openURL(c.url)}>
              <Text style={s.creditLink}>{c.name} ↗</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  logoIcon: {
    fontSize: 56,
    marginBottom: 4,
  },
  logoName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f0f0f0',
    letterSpacing: -1,
  },
  logoAccent: {
    color: '#ff6b35',
  },
  logoVersion: {
    fontSize: 12,
    color: '#444',
    fontWeight: '600',
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1.2,
  },
  body: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 21,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#161616',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'flex-start',
  },
  featureIcon: {
    fontSize: 22,
    marginTop: 1,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
  },
  tipList: {
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipBullet: {
    color: '#ff6b35',
    fontWeight: '700',
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  privacyBadge: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,107,53,0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.15)',
    alignItems: 'flex-start',
  },
  privacyIcon: {
    fontSize: 22,
    marginTop: 1,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: '#888',
    lineHeight: 19,
  },
  creditList: {
    gap: 8,
  },
  creditLink: {
    fontSize: 14,
    color: '#ff6b35',
    fontWeight: '500',
  },
});
