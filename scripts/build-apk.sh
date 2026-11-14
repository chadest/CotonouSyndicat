#!/usr/bin/env bash
set -euo pipefail

# Build script for Cotonou Syndicat Android WebView APK
# 1. Builds the Vite/Three.js web app with relative paths (--base="./")
# 2. Embeds all HTML, JS, CSS, 3D GLB, and audio files into android/app/src/main/assets/
# 3. Compiles the Android WebView APK via Gradle

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
OUTPUT_DIR="$ROOT_DIR/build"

MODE="debug"
ASSETS_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --release)
      MODE="release"
      ;;
    --assets-only)
      ASSETS_ONLY=true
      ;;
  esac
done

echo "==> [1/3] Build de l'application Web (Vite)..."
cd "$ROOT_DIR"
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  npm ci
fi
npm run build -- --base="./"

echo "==> [2/3] Imbrication des assets HTML/3D/Audio dans android/app/src/main/assets..."
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
cp -R "$ROOT_DIR/dist/." "$ASSETS_DIR/"
# Exclure les images de référence non utilisées au runtime pour alléger l'APK
rm -rf "$ASSETS_DIR/assets/aistudio"

echo "    Assets imbriqués avec succès dans : $ASSETS_DIR"

if [ "$ASSETS_ONLY" = true ]; then
  echo "==> Mode --assets-only terminé."
  exit 0
fi

echo "==> [3/3] Compilation de l'APK Android (WebView)..."
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$SDK_DIR" ] && [ ! -f "$ANDROID_DIR/local.properties" ]; then
  echo "ERREUR : Android SDK introuvable (ANDROID_HOME ou ANDROID_SDK_ROOT non défini)."
  echo "Les assets HTML ont bien été générés dans android/app/src/main/assets/."
  echo "Pour générer l'APK :"
  echo "  - En local : installez Android SDK / Android Studio et définissez ANDROID_HOME, puis relancez 'npm run build:apk'."
  echo "  - Sur GitHub : poussez le code et lancez le workflow 'Build Android APK (WebView)'."
  exit 1
fi

cd "$ANDROID_DIR"
if [ -x "./gradlew" ]; then
  GRADLE_CMD="./gradlew"
elif command -v gradle >/dev/null 2>&1; then
  GRADLE_CMD="gradle"
else
  echo "ERREUR : Ni ./gradlew ni gradle n'est installé sur cette machine."
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
if [ "$MODE" = "release" ]; then
  "$GRADLE_CMD" assembleRelease --no-daemon
  cp "$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk" "$OUTPUT_DIR/CotonouSyndicat-release.apk"
  echo "==> APK généré : $OUTPUT_DIR/CotonouSyndicat-release.apk"
else
  "$GRADLE_CMD" assembleDebug --no-daemon
  cp "$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk" "$OUTPUT_DIR/CotonouSyndicat-debug.apk"
  echo "==> APK généré : $OUTPUT_DIR/CotonouSyndicat-debug.apk"
fi
