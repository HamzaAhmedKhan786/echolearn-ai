package com.example.echolearn_ai

import android.os.Bundle
import android.speech.tts.TextToSpeech
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.Locale

class MainActivity : FlutterActivity(), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tts = TextToSpeech(this, this)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "echolearn.ai/native"
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "pickAndImportDocument" -> {
                    result.success(
                        mapOf(
                            "id" to "",
                            "title" to "Native import bridge ready",
                            "chunkCount" to 0
                        )
                    )
                }
                "speak" -> {
                    val text = call.argument<String>("text").orEmpty()
                    if (!ttsReady || text.isBlank()) {
                        result.error("TTS_NOT_READY", "Android TextToSpeech is not ready.", null)
                    } else {
                        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "echolearn-tts")
                        result.success(null)
                    }
                }
                "stopSpeaking" -> {
                    tts?.stop()
                    result.success(null)
                }
                "askQuestion" -> {
                    val question = call.argument<String>("question").orEmpty()
                    result.success(
                        mapOf(
                            "answer" to "Mobile bridge received: $question. Connect shared storage to answer from imported chunks.",
                            "citations" to emptyList<String>()
                        )
                    )
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true
            tts?.language = Locale.US
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }
}
