#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
sdk_dir="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$sdk_dir" ]]; then echo 'Set ANDROID_SDK_ROOT to an Android SDK with platform 35 and build-tools 35.0.0.' >&2; exit 1; fi
build_tools="$sdk_dir/build-tools/35.0.0"
android_jar="$sdk_dir/platforms/android-35/android.jar"
build_dir="$project_dir/build"
python3 "$project_dir/tools/prepare_assets.py"
mkdir -p "$build_dir/classes" "$build_dir/dex"
python3 - "$project_dir" "$build_dir" <<'PYMANIFEST'
import pathlib,sys
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
s=(root/'android/app/src/main/AndroidManifest.xml').read_text().replace('<manifest ', '<manifest package="com.moportor6.pokesurvivor" ',1)
(out/'AndroidManifest.xml').write_text(s)
PYMANIFEST
"$build_tools/aapt2" link -o "$build_dir/base.apk" -I "$android_jar" --manifest "$build_dir/AndroidManifest.xml" -A "$project_dir/android/app/src/main/assets" --rename-manifest-package com.moportor6.pokesurvivor --min-sdk-version 23 --target-sdk-version 35 --version-code 1 --version-name 0.1.0-partial
if command -v javac >/dev/null 2>&1; then
    javac --release 8 -classpath "$android_jar" -d "$build_dir/classes" "$project_dir/android/app/src/main/java/com/moportor6/pokesurvivor/MainActivity.java"
else
    java -jar "${ECJ_JAR:?Set ECJ_JAR when a JDK is unavailable}" -1.8 -proc:none -bootclasspath "$android_jar:$build_tools/core-lambda-stubs.jar" -d "$build_dir/classes" "$project_dir/android/app/src/main/java/com/moportor6/pokesurvivor/MainActivity.java"
fi
"$build_tools/d8" --lib "$android_jar" --min-api 23 --output "$build_dir/dex" "$build_dir/classes/com/moportor6/pokesurvivor/"*.class
python3 - "$build_dir" <<'PY'
import sys,zipfile,pathlib
p=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(p/'base.apk','a',zipfile.ZIP_DEFLATED) as z:z.write(p/'dex/classes.dex','classes.dex')
PY
"$build_tools/zipalign" -f 4 "$build_dir/base.apk" "$build_dir/aligned.apk"
signing_key="${POKESURVIVOR_KEYSTORE:-$build_dir/debug.keystore}"
if [[ ! -f "$signing_key" ]]; then
    keytool -genkeypair -keystore "$signing_key" -storepass android -keypass android -alias androiddebugkey -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000 -noprompt
fi
"$build_tools/apksigner" sign --ks "$signing_key" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$build_dir/Pokesurvivor-Offline-0.1.0-partial.apk" "$build_dir/aligned.apk"
"$build_tools/apksigner" verify --verbose "$build_dir/Pokesurvivor-Offline-0.1.0-partial.apk"
"$build_tools/aapt" dump permissions "$build_dir/Pokesurvivor-Offline-0.1.0-partial.apk" > "$build_dir/permissions.txt"
if grep -q 'android.permission.INTERNET' "$build_dir/permissions.txt"; then echo 'Unexpected INTERNET permission' >&2;exit 1;fi
sha256sum "$build_dir/Pokesurvivor-Offline-0.1.0-partial.apk" > "$build_dir/SHA256SUMS.txt"
echo "APK ready: $build_dir/Pokesurvivor-Offline-0.1.0-partial.apk"
