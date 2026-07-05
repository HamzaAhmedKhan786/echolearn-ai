import 'package:flutter/services.dart';

class EchoLearnBridge {
  const EchoLearnBridge({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('echolearn.ai/native');

  final MethodChannel _channel;

  Future<ImportedDocument?> pickAndImportDocument() {
    return _invokeMap('pickAndImportDocument')
        .then((value) => value == null ? null : ImportedDocument.fromMap(value))
        .onError<MissingPluginException>((_, __) => null);
  }

  Future<void> speak(String text, {double rate = 1.0}) {
    return _channel.invokeMethod<void>('speak', {
      'text': text,
      'rate': rate,
    }).onError<MissingPluginException>((_, __) => null);
  }

  Future<void> stopSpeaking() {
    return _channel
        .invokeMethod<void>('stopSpeaking')
        .onError<MissingPluginException>((_, __) => null);
  }

  Future<void> saveApiKey({
    required String provider,
    required String key,
  }) {
    return _channel.invokeMethod<void>('saveApiKey', {
      'provider': provider,
      'key': key,
    });
  }

  Future<bool> hasApiKey(String provider) {
    return _channel
        .invokeMethod<bool>('hasApiKey', {'provider': provider}).then(
      (value) => value ?? false,
    );
  }

  Future<void> deleteApiKey(String provider) {
    return _channel.invokeMethod<void>('deleteApiKey', {'provider': provider});
  }

  Future<void> saveMobileState(String state) {
    return _channel.invokeMethod<void>('saveMobileState',
        {'state': state}).onError<MissingPluginException>((_, __) => null);
  }

  Future<String?> loadMobileState() {
    return _channel
        .invokeMethod<String>('loadMobileState')
        .onError<MissingPluginException>((_, __) => null);
  }

  Future<TutorAnswer> askQuestion({
    required String documentId,
    required String question,
    required String scope,
  }) {
    return _invokeMap('askQuestion', {
      'documentId': documentId,
      'question': question,
      'scope': scope,
    }).then((value) => TutorAnswer.fromMap(value ?? const {}));
  }

  Future<Map<String, Object?>?> _invokeMap(
    String method, [
    Map<String, Object?> arguments = const {},
  ]) async {
    final result =
        await _channel.invokeMapMethod<String, Object?>(method, arguments);
    return result == null ? null : Map<String, Object?>.from(result);
  }
}

class ImportedDocument {
  const ImportedDocument({
    required this.id,
    required this.title,
    required this.chunkCount,
    required this.chunks,
  });

  final String id;
  final String title;
  final int chunkCount;
  final List<String> chunks;

  factory ImportedDocument.fromMap(Map<String, Object?> map) {
    final rawChunks = map['chunks'];
    final chunks = rawChunks is List
        ? rawChunks.map((item) => item.toString()).toList()
        : const <String>[];
    return ImportedDocument(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? 'Untitled',
      chunkCount: map['chunkCount'] as int? ?? chunks.length,
      chunks: chunks,
    );
  }
}

class TutorAnswer {
  const TutorAnswer({
    required this.answer,
    required this.citations,
  });

  final String answer;
  final List<String> citations;

  factory TutorAnswer.fromMap(Map<String, Object?> map) {
    final rawCitations = map['citations'];
    return TutorAnswer(
      answer: map['answer'] as String? ?? '',
      citations: rawCitations is List
          ? rawCitations.map((item) => item.toString()).toList()
          : const [],
    );
  }
}
