$dirs = @(
"desktop/app/src/pages",
"desktop/app/src/components",
"desktop/app/src/features/document_reader",
"desktop/app/src/features/ai_chat",
"desktop/app/src/features/study_tools",
"desktop/app/src/features/settings",
"desktop/app/src/services",
"desktop/app/src/stores",
"desktop/app/src/hooks",
"desktop/app/public",

"desktop/tauri/src",
"desktop/tauri/commands",
"desktop/tauri/plugins",
"desktop/tauri/capabilities",

"desktop/ai-runtime/llama_cpp",
"desktop/ai-runtime/faiss",
"desktop/ai-runtime/piper",
"desktop/ai-runtime/embeddings",

"desktop/packaging/windows",
"desktop/packaging/linux",
"desktop/packaging/macos",
"desktop/tests",

"mobile/flutter_app/lib/core",
"mobile/flutter_app/lib/features/document_reader",
"mobile/flutter_app/lib/features/ai_chat",
"mobile/flutter_app/lib/features/study_tools",
"mobile/flutter_app/lib/features/settings",
"mobile/flutter_app/lib/presentation",
"mobile/flutter_app/lib/widgets",
"mobile/flutter_app/lib/providers",
"mobile/flutter_app/lib/routes",
"mobile/flutter_app/lib/services",
"mobile/flutter_app/assets",
"mobile/flutter_app/test",
"mobile/flutter_app/integration_test",

"mobile/android/native_ai",
"mobile/android/native_tts",
"mobile/android/native_storage",

"mobile/ios/native_ai",
"mobile/ios/native_tts",
"mobile/ios/native_storage"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$files = @(
"desktop/README.md",
"desktop/app/README.md",
"desktop/tauri/README.md",
"desktop/ai-runtime/README.md",
"desktop/packaging/README.md",

"mobile/README.md",
"mobile/flutter_app/README.md",
"mobile/android/README.md",
"mobile/ios/README.md"
)

foreach ($file in $files) {
    New-Item -ItemType File -Path $file -Force | Out-Null
}

Write-Host "Desktop and mobile platform structure created."