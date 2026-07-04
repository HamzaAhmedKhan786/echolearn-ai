import Flutter
import UIKit
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private let speechSynthesizer = AVSpeechSynthesizer()

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
        result([
          "id": "",
          "title": "Native import bridge ready",
          "chunkCount": 0,
        ])
      case "speak":
        let arguments = call.arguments as? [String: Any]
        let text = arguments?["text"] as? String ?? ""
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
          result(FlutterError(code: "EMPTY_TEXT", message: "Text is required for speech.", details: nil))
          return
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        self?.speechSynthesizer.speak(utterance)
        result(nil)
      case "stopSpeaking":
        self?.speechSynthesizer.stopSpeaking(at: .immediate)
        result(nil)
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
}
