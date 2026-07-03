import 'package:flutter/services.dart';

class EchoLearnBridge {
  const EchoLearnBridge({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('echolearn.ai/native');

  final MethodChannel _channel;

  Future<ImportedDocument?> pickAndImportDocument() {
    return _invokeMap('pickAndImportDocument').then(
      (value) => value == null ? null : ImportedDocument.fromMap(value),
    );
  }

  Future<void> speak(String text) {
    return _channel.invokeMethod<void>('speak', {'text': text});
  }

  Future<void> stopSpeaking() {
    return _channel.invokeMethod<void>('stopSpeaking');
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
    final result = await _channel.invokeMapMethod<String, Object?>(method, arguments);
    return result == null ? null : Map<String, Object?>.from(result);
  }
}

class ImportedDocument {
  const ImportedDocument({
    required this.id,
    required this.title,
    required this.chunkCount,
  });

  final String id;
  final String title;
  final int chunkCount;

  factory ImportedDocument.fromMap(Map<String, Object?> map) {
    return ImportedDocument(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? 'Untitled',
      chunkCount: map['chunkCount'] as int? ?? 0,
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
