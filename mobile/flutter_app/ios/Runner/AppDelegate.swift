import Flutter
import UIKit
import AVFoundation
import Security
import UniformTypeIdentifiers

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, UIDocumentPickerDelegate {
  private let speechSynthesizer = AVSpeechSynthesizer()
  private var pendingDocumentResult: FlutterResult?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    if let controller = window?.rootViewController as? FlutterViewController {
      configureEchoLearnBridge(controller.binaryMessenger)
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }

  private func configureEchoLearnBridge(_ messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "echolearn.ai/native", binaryMessenger: messenger)
    channel.setMethodCallHandler { [weak self] call, result in
      switch call.method {
      case "pickAndImportDocument":
        guard self?.pendingDocumentResult == nil else {
          result(FlutterError(code: "PICK_IN_PROGRESS", message: "A document picker is already open.", details: nil))
          return
        }
        self?.pendingDocumentResult = result
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText, .text, .json, .xml, .html], asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        controller.present(picker, animated: true)
      case "speak":
        let arguments = call.arguments as? [String: Any]
        let text = arguments?["text"] as? String ?? ""
        let rate = max(0.5, min(arguments?["rate"] as? Double ?? 1.0, 1.8))
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
          result(FlutterError(code: "EMPTY_TEXT", message: "Text is required for speech.", details: nil))
          return
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * Float(rate)
        self?.speechSynthesizer.speak(utterance)
        result(nil)
      case "stopSpeaking":
        self?.speechSynthesizer.stopSpeaking(at: .immediate)
        result(nil)
      case "saveApiKey":
        let arguments = call.arguments as? [String: Any]
        let provider = arguments?["provider"] as? String ?? ""
        let key = arguments?["key"] as? String ?? ""
        guard !provider.isEmpty, !key.isEmpty else {
          result(FlutterError(code: "INVALID_KEY", message: "Provider and key are required.", details: nil))
          return
        }
        self?.saveSecret(provider: provider, value: key)
        result(nil)
      case "hasApiKey":
        let arguments = call.arguments as? [String: Any]
        let provider = arguments?["provider"] as? String ?? ""
        result(self?.hasSecret(provider: provider) ?? false)
      case "deleteApiKey":
        let arguments = call.arguments as? [String: Any]
        let provider = arguments?["provider"] as? String ?? ""
        self?.deleteSecret(provider: provider)
        result(nil)
      case "saveMobileState":
        let arguments = call.arguments as? [String: Any]
        let state = arguments?["state"] as? String ?? ""
        UserDefaults.standard.set(state, forKey: "echolearn_mobile_state")
        result(nil)
      case "loadMobileState":
        result(UserDefaults.standard.string(forKey: "echolearn_mobile_state"))
      case "askQuestion":
        let arguments = call.arguments as? [String: Any]
        let question = arguments?["question"] as? String ?? ""
        result([
          "answer": "Mobile bridge received: \(question). Connect shared storage to answer from imported chunks.",
          "citations": [],
        ])
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let result = pendingDocumentResult else { return }
    pendingDocumentResult = nil
    guard let url = urls.first else {
      result(nil)
      return
    }

    let scoped = url.startAccessingSecurityScopedResource()
    defer {
      if scoped {
        url.stopAccessingSecurityScopedResource()
      }
    }

    do {
      let text = try String(contentsOf: url, encoding: .utf8)
      let chunks = chunkText(text)
      result([
        "id": "ios-\(Int(Date().timeIntervalSince1970 * 1000))",
        "title": url.lastPathComponent,
        "chunkCount": chunks.count,
        "chunks": chunks,
      ])
    } catch {
      result(FlutterError(code: "READ_FAILED", message: "Could not read this document as text.", details: error.localizedDescription))
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pendingDocumentResult?(nil)
    pendingDocumentResult = nil
  }

  private func chunkText(_ text: String) -> [String] {
    let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if normalized.isEmpty {
      return []
    }

    var chunks: [String] = []
    var start = normalized.startIndex
    let target = 1400
    let overlap = 220

    while start < normalized.endIndex {
      let end = normalized.index(start, offsetBy: target, limitedBy: normalized.endIndex) ?? normalized.endIndex
      let chunk = String(normalized[start..<end]).trimmingCharacters(in: .whitespacesAndNewlines)
      if !chunk.isEmpty {
        chunks.append(chunk)
      }
      if end == normalized.endIndex {
        break
      }
      start = normalized.index(end, offsetBy: -overlap, limitedBy: normalized.startIndex) ?? normalized.startIndex
    }
    return chunks
  }

  private func keychainQuery(provider: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "echolearn.ai.api-keys",
      kSecAttrAccount as String: provider,
    ]
  }

  private func saveSecret(provider: String, value: String) {
    deleteSecret(provider: provider)
    var query = keychainQuery(provider: provider)
    query[kSecValueData as String] = value.data(using: .utf8)
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    SecItemAdd(query as CFDictionary, nil)
  }

  private func hasSecret(provider: String) -> Bool {
    var query = keychainQuery(provider: provider)
    query[kSecReturnData as String] = false
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    return SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess
  }

  private func deleteSecret(provider: String) {
    SecItemDelete(keychainQuery(provider: provider) as CFDictionary)
  }
}
