#include "flutter_window.h"

#include <flutter/standard_method_codec.h>
#include <windows.h>

#include <optional>
#include <string>

#include "flutter/generated_plugin_registrant.h"

FlutterWindow::FlutterWindow(const flutter::DartProject& project)
    : project_(project) {}

FlutterWindow::~FlutterWindow() {}

bool FlutterWindow::OnCreate() {
  if (!Win32Window::OnCreate()) {
    return false;
  }

  RECT frame = GetClientArea();

  // The size here must match the window dimensions to avoid unnecessary surface
  // creation / destruction in the startup path.
  flutter_controller_ = std::make_unique<flutter::FlutterViewController>(
      frame.right - frame.left, frame.bottom - frame.top, project_);
  // Ensure that basic setup of the controller was successful.
  if (!flutter_controller_->engine() || !flutter_controller_->view()) {
    return false;
  }
  RegisterPlugins(flutter_controller_->engine());
  native_channel_ = std::make_unique<flutter::MethodChannel<flutter::EncodableValue>>(
      flutter_controller_->engine()->messenger(), "echolearn.ai/native",
      &flutter::StandardMethodCodec::GetInstance());
  native_channel_->SetMethodCallHandler(
      [](const flutter::MethodCall<flutter::EncodableValue>& call,
         std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {
        const auto& method = call.method_name();

        if (method == "pickAndImportDocument") {
          flutter::EncodableMap document;
          document[flutter::EncodableValue("id")] =
              flutter::EncodableValue("windows-preview");
          document[flutter::EncodableValue("title")] =
              flutter::EncodableValue("Windows bridge preview");
          document[flutter::EncodableValue("chunkCount")] =
              flutter::EncodableValue(0);
          result->Success(flutter::EncodableValue(document));
          return;
        }

        if (method == "speak") {
          MessageBeep(MB_ICONINFORMATION);
          result->Success();
          return;
        }

        if (method == "stopSpeaking") {
          result->Success();
          return;
        }

        if (method == "askQuestion") {
          flutter::EncodableMap answer;
          answer[flutter::EncodableValue("answer")] =
              flutter::EncodableValue(
                  "Windows bridge is connected. Full mobile document storage "
                  "and grounded Q&A are still pending.");
          answer[flutter::EncodableValue("citations")] =
              flutter::EncodableValue(flutter::EncodableList());
          result->Success(flutter::EncodableValue(answer));
          return;
        }

        result->NotImplemented();
      });
  SetChildContent(flutter_controller_->view()->GetNativeWindow());

  flutter_controller_->engine()->SetNextFrameCallback([&]() {
    this->Show();
  });

  // Flutter can complete the first frame before the "show window" callback is
  // registered. The following call ensures a frame is pending to ensure the
  // window is shown. It is a no-op if the first frame hasn't completed yet.
  flutter_controller_->ForceRedraw();

  return true;
}

void FlutterWindow::OnDestroy() {
  native_channel_ = nullptr;
  if (flutter_controller_) {
    flutter_controller_ = nullptr;
  }

  Win32Window::OnDestroy();
}

LRESULT
FlutterWindow::MessageHandler(HWND hwnd, UINT const message,
                              WPARAM const wparam,
                              LPARAM const lparam) noexcept {
  // Give Flutter, including plugins, an opportunity to handle window messages.
  if (flutter_controller_) {
    std::optional<LRESULT> result =
        flutter_controller_->HandleTopLevelWindowProc(hwnd, message, wparam,
                                                      lparam);
    if (result) {
      return *result;
    }
  }

  switch (message) {
    case WM_FONTCHANGE:
      flutter_controller_->engine()->ReloadSystemFonts();
      break;
  }

  return Win32Window::MessageHandler(hwnd, message, wparam, lparam);
}
