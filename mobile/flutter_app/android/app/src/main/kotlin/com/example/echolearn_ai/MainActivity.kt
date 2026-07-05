package com.example.echolearn_ai

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Base64
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.KeyStore
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MainActivity : FlutterActivity(), TextToSpeech.OnInitListener {
    private val channelName = "echolearn.ai/native"
    private val pickDocumentRequest = 1207
    private var pendingPickResult: MethodChannel.Result? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tts = TextToSpeech(this, this)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            when (call.method) {
                "pickAndImportDocument" -> {
                    if (pendingPickResult != null) {
                        result.error("PICK_IN_PROGRESS", "A document picker is already open.", null)
                    } else {
                        pendingPickResult = result
                        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "*/*"
                            putExtra(
                                Intent.EXTRA_MIME_TYPES,
                                arrayOf(
                                    "text/plain",
                                    "text/markdown",
                                    "text/csv",
                                    "application/json",
                                    "application/xml",
                                    "text/html"
                                )
                            )
                        }
                        startActivityForResult(intent, pickDocumentRequest)
                    }
                }
                "speak" -> {
                    val text = call.argument<String>("text").orEmpty()
                    val rate = (call.argument<Double>("rate") ?: 1.0).toFloat().coerceIn(0.5f, 1.8f)
                    if (!ttsReady || text.isBlank()) {
                        result.error("TTS_NOT_READY", "Android TextToSpeech is not ready.", null)
                    } else {
                        tts?.setSpeechRate(rate)
                        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "echolearn-tts")
                        result.success(null)
                    }
                }
                "stopSpeaking" -> {
                    tts?.stop()
                    result.success(null)
                }
                "saveApiKey" -> {
                    val provider = call.argument<String>("provider").orEmpty()
                    val key = call.argument<String>("key").orEmpty()
                    if (provider.isBlank() || key.isBlank()) {
                        result.error("INVALID_KEY", "Provider and key are required.", null)
                    } else {
                        saveSecret(provider, key)
                        result.success(null)
                    }
                }
                "hasApiKey" -> {
                    val provider = call.argument<String>("provider").orEmpty()
                    result.success(loadSecret(provider) != null)
                }
                "deleteApiKey" -> {
                    val provider = call.argument<String>("provider").orEmpty()
                    getPreferences(MODE_PRIVATE).edit()
                        .remove("api_key_${provider}_iv")
                        .remove("api_key_${provider}_value")
                        .apply()
                    result.success(null)
                }
                "saveMobileState" -> {
                    val state = call.argument<String>("state").orEmpty()
                    getPreferences(MODE_PRIVATE).edit().putString("mobile_state", state).apply()
                    result.success(null)
                }
                "loadMobileState" -> {
                    result.success(getPreferences(MODE_PRIVATE).getString("mobile_state", null))
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

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != pickDocumentRequest) return

        val result = pendingPickResult
        pendingPickResult = null

        if (result == null) return
        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            result.success(null)
            return
        }

        val uri = data.data!!
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: SecurityException) {
            // Some providers do not grant persistable permissions.
        }

        val title = uri.lastPathSegment?.substringAfterLast('/') ?: "Imported document"
        val text = contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }.orEmpty()
        val chunks = chunkText(text)
        result.success(
            mapOf(
                "id" to "android-${System.currentTimeMillis()}",
                "title" to title,
                "chunkCount" to chunks.size,
                "chunks" to chunks
            )
        )
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

    private fun chunkText(text: String): List<String> {
        val normalized = text.replace("\r\n", "\n").trim()
        if (normalized.isBlank()) return emptyList()

        val chunks = mutableListOf<String>()
        var start = 0
        val target = 1400
        val overlap = 220
        while (start < normalized.length) {
            val end = minOf(normalized.length, start + target)
            val chunk = normalized.substring(start, end).trim()
            if (chunk.isNotBlank()) chunks.add(chunk)
            if (end >= normalized.length) break
            start = maxOf(0, end - overlap)
        }
        return chunks
    }

    private fun saveSecret(provider: String, value: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        getPreferences(MODE_PRIVATE).edit()
            .putString("api_key_${provider}_iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("api_key_${provider}_value", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply()
    }

    private fun loadSecret(provider: String): String? {
        val prefs = getPreferences(MODE_PRIVATE)
        val iv = prefs.getString("api_key_${provider}_iv", null) ?: return null
        val value = prefs.getString("api_key_${provider}_value", null) ?: return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateSecretKey(),
            GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
        )
        return String(cipher.doFinal(Base64.decode(value, Base64.NO_WRAP)), Charsets.UTF_8)
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val alias = "echolearn_api_keys"
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let {
            return it.secretKey
        }

        val keyGenerator = KeyGenerator.getInstance("AES", "AndroidKeyStore")
        keyGenerator.init(
            android.security.keystore.KeyGenParameterSpec.Builder(
                alias,
                android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or
                    android.security.keystore.KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .build()
        )
        return keyGenerator.generateKey()
    }
}
