# SoftPage iOS

A beautiful PDF recoloring app for iOS, built with React Native and Expo.

## Features

- 🎨 **8 Built-in Palettes** — Classic Dark, Warm Sepia, Night Blue, AMOLED, and more
- 💾 **Custom Palettes** — Create and save your own background + text color combinations
- 🖼 **Preserve Images** — Detects and leaves photo blocks untouched during recoloring
- ⚡ **100% On-Device** — Your PDFs never leave your phone
- 📤 **Native iOS Sharing** — Save to Files, AirDrop, share via email, and more

## Getting Started

### Prerequisites

1. **Node.js (v18 or v20)** — Download from [nodejs.org](https://nodejs.org)
2. **Expo Go** — Download from the [App Store](https://apps.apple.com/app/expo-go/id982107779) on your iPhone

### Installation

```bash
# Clone or navigate to this directory
cd softpage-ios

# Install dependencies
npm install --legacy-peer-deps

# Start the development server
npm start
```

Then scan the QR code with your iPhone's camera (or the Expo Go app) to open the app.

## Architecture

The app uses a hidden `react-native-webview` as a processing engine, since React Native does not natively support HTML5 `<canvas>`. The native UI communicates with the WebView via `postMessage`/`onMessage` for all PDF operations.

```
Native UI (Expo Router + React Native)
    ↕ postMessage / onMessage
Hidden WebView (pdfjs-dist + pdf-lib + recoloring logic)
    ↕ expo-file-system
Local iOS Files
    ↕ expo-sharing
iOS Share Sheet
```

## Development Notes

- The WebView processor loads `pdfjs-dist` and `pdf-lib` from jsDelivr CDN
- This means an internet connection is required during PDF processing
- All processing is still done client-side (in the WebView sandbox)

## Web App (Original)

See the `../softpage` directory for the original Vite/React web application that this iOS port is based on.
