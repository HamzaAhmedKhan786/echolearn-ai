import 'package:device_preview/device_preview.dart';
import 'package:flutter/material.dart';
import 'services/echolearn_bridge.dart';

void main() {
  runApp(
    DevicePreview(
      enabled: true,
      builder: (context) => const EchoLearnMobileApp(),
    ),
  );
}

class EchoLearnMobileApp extends StatelessWidget {
  const EchoLearnMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EchoLearn AI',
      debugShowCheckedModeBanner: false,
      locale: DevicePreview.locale(context),
      builder: DevicePreview.appBuilder,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF22C55E),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF0B1020),
        cardTheme: const CardThemeData(
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
          ),
        ),
      ),
      home: const AppShell(),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int selectedIndex = 0;
  final List<MobileDocument> documents = [];
  final List<String> chatMessages = ['Import a document, then ask a question about its topic.'];
  MobileDocument? selectedDocument;
  String learnerAge = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => showStartupGuide());
  }

  Future<void> showStartupGuide() {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Welcome to EchoLearn'),
        content: const SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('How to use EchoLearn'),
              SizedBox(height: 8),
              Text('- Import a PDF, Word, EPUB, or text document.'),
              Text('- Listen with built-in phone voices.'),
              Text('- Ask questions that stay on the document topic.'),
              SizedBox(height: 14),
              Text('AI choices'),
              SizedBox(height: 8),
              Text('- Use your own API key for hosted AI.'),
              Text('- Use local AI when an on-device model is available.'),
              Text('- EchoLearn can explain beyond the file only when the topic still matches.'),
              SizedBox(height: 14),
              Text('Privacy'),
              SizedBox(height: 8),
              Text('- Documents and chats stay on your device unless you choose an external AI provider.'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      LibraryPage(
        documents: documents,
        selectedDocument: selectedDocument,
        onImported: (document) {
          setState(() {
            documents.removeWhere((item) => item.id == document.id);
            documents.insert(0, document);
            selectedDocument = document;
            chatMessages
              ..clear()
              ..add('Document "${document.title}" is ready for reading and topic-focused questions.');
          });
        },
        onSelected: (document) {
          setState(() => selectedDocument = document);
        },
      ),
      ReaderPage(document: selectedDocument),
      TutorPage(
        document: selectedDocument,
        learnerAge: learnerAge,
        messages: chatMessages,
        onMessage: (message) {
          setState(() => chatMessages.add(message));
        },
      ),
      StudyPage(document: selectedDocument),
      SettingsPage(
        learnerAge: learnerAge,
        onLearnerAgeChanged: (value) {
          setState(() => learnerAge = value);
        },
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            EchoLearnMark(size: 30),
            SizedBox(width: 10),
            Text('EchoLearn AI'),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Guide',
            icon: const Icon(Icons.help_outline),
            onPressed: showStartupGuide,
          ),
          const Padding(
            padding: EdgeInsets.only(right: 16),
            child: Chip(
              label: Text('Offline'),
              avatar: Icon(Icons.lock_outline, size: 16),
            ),
          ),
        ],
      ),
      body: pages[selectedIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          setState(() => selectedIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.library_books_outlined),
            selectedIcon: Icon(Icons.library_books),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.article_outlined),
            selectedIcon: Icon(Icons.article),
            label: 'Reader',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble),
            label: 'Tutor',
          ),
          NavigationDestination(
            icon: Icon(Icons.school_outlined),
            selectedIcon: Icon(Icons.school),
            label: 'Study',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

class MobileDocument {
  const MobileDocument({
    required this.id,
    required this.title,
    required this.chunks,
  });

  final String id;
  final String title;
  final List<String> chunks;

  int get chunkCount => chunks.length;
}

class LibraryPage extends StatefulWidget {
  const LibraryPage({
    required this.documents,
    required this.selectedDocument,
    required this.onImported,
    required this.onSelected,
    super.key,
  });

  final List<MobileDocument> documents;
  final MobileDocument? selectedDocument;
  final ValueChanged<MobileDocument> onImported;
  final ValueChanged<MobileDocument> onSelected;

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  String status = 'No document imported yet.';

  Future<void> importDocument() async {
    try {
      final document = await mobileBridge.pickAndImportDocument();
      if (document != null) {
        widget.onImported(
          MobileDocument(
            id: document.id,
            title: document.title,
            chunks: document.chunks.isEmpty
                ? ['${document.title} was imported. Native parser chunks will appear here when provided by the device bridge.']
                : document.chunks,
          ),
        );
      }
      setState(() {
        status = document == null
            ? 'Import cancelled.'
            : 'Imported ${document.title} with ${document.chunkCount} chunks.';
      });
    } catch (error) {
      setState(() => status = 'Import is not available on this device yet: $error');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PageFrame(
      title: 'Library',
      subtitle: 'Import private PDF, Word, EPUB, and text documents.',
      children: [
        BridgeActionPanel(
          icon: Icons.upload_file,
          title: 'Import document',
          body: status,
          buttonLabel: 'Import',
          onPressed: importDocument,
        ),
        const ActionPanel(
          icon: Icons.lock_outline,
          title: 'Private local library',
          body: 'Imported documents are prepared for reading, listening, and topic-focused tutoring.',
        ),
        if (widget.documents.isNotEmpty)
          ...widget.documents.map(
            (document) => ActionPanel(
              icon: Icons.description_outlined,
              title: document.title,
              body: '${document.chunkCount} chunks ready${widget.selectedDocument?.id == document.id ? ' - selected' : ''}',
              trailing: TextButton(
                onPressed: () => widget.onSelected(document),
                child: const Text('Open'),
              ),
            ),
          ),
        MetricGrid(
          items: [
            MetricItem(label: 'Documents', value: '${widget.documents.length}'),
            MetricItem(
              label: 'Ready chunks',
              value: '${widget.documents.fold<int>(0, (total, doc) => total + doc.chunkCount)}',
            ),
            const MetricItem(label: 'Chats saved', value: 'Local'),
            const MetricItem(label: 'Study items', value: 'Auto'),
          ],
        ),
      ],
    );
  }
}

const mobileBridge = EchoLearnBridge();

class ReaderPage extends StatelessWidget {
  const ReaderPage({required this.document, super.key});

  final MobileDocument? document;

  @override
  Widget build(BuildContext context) {
    return PageFrame(
      title: 'Reader',
      subtitle: 'Read, listen, highlight, and navigate imported content.',
      children: [
        BridgeActionPanel(
          icon: Icons.volume_up_outlined,
          title: 'Read aloud',
          body: document == null
              ? 'Import a document to start listening.'
              : 'Ready to read "${document!.title}" with built-in Android or iOS voices.',
          buttonLabel: 'Speak',
          onPressed: () => mobileBridge.speak(
            document != null && document!.chunks.isNotEmpty
                ? document!.chunks.first
                : 'EchoLearn mobile text to speech is connected.',
          ),
        ),
        if (document != null)
          ...document!.chunks.take(4).map(
                (chunk) => ActionPanel(
                  icon: Icons.notes_outlined,
                  title: 'Document chunk',
                  body: chunk,
                ),
              ),
      ],
    );
  }
}

class TutorPage extends StatefulWidget {
  const TutorPage({
    required this.document,
    required this.learnerAge,
    required this.messages,
    required this.onMessage,
    super.key,
  });

  final MobileDocument? document;
  final String learnerAge;
  final List<String> messages;
  final ValueChanged<String> onMessage;

  @override
  State<TutorPage> createState() => _TutorPageState();
}

class _TutorPageState extends State<TutorPage> {
  final questionController = TextEditingController();

  @override
  void dispose() {
    questionController.dispose();
    super.dispose();
  }

  Future<void> askQuestion() async {
    final question = questionController.text.trim();
    if (question.isEmpty) return;

    widget.onMessage('You: $question');
    questionController.clear();

    if (widget.document == null) {
      widget.onMessage('EchoLearn: Import a document first so I can stay focused on its topic.');
      return;
    }

    try {
      final response = await mobileBridge.askQuestion(
        documentId: widget.document!.id,
        question: question,
        scope: 'Whole document',
      );
      widget.onMessage('EchoLearn: ${response.answer}');
    } catch (error) {
      widget.onMessage('EchoLearn: ${localTopicAnswer(widget.document!, question, widget.learnerAge)}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PageFrame(
      title: 'AI Tutor',
      subtitle: 'Ask questions that stay focused on the uploaded document topic.',
      children: [
        Card(
          color: const Color(0xFF111827),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                TextField(
                  controller: questionController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Ask about the document',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton(
                    onPressed: askQuestion,
                    child: const Text('Ask'),
                  ),
                ),
              ],
            ),
          ),
        ),
        ...widget.messages.reversed.take(8).map(
              (message) => ActionPanel(
                icon: message.startsWith('You:') ? Icons.person_outline : Icons.psychology_alt_outlined,
                title: message.startsWith('You:') ? 'You' : 'EchoLearn',
                body: message.replaceFirst('You: ', '').replaceFirst('EchoLearn: ', ''),
              ),
            ),
        ActionPanel(
          icon: Icons.psychology_alt_outlined,
          title: 'Topic rule',
          body: widget.document == null
              ? 'Import a document before asking.'
              : 'Answers must strongly match "${widget.document!.title}".',
        ),
      ],
    );
  }
}

class StudyPage extends StatelessWidget {
  const StudyPage({required this.document, super.key});

  final MobileDocument? document;

  @override
  Widget build(BuildContext context) {
    final items = document?.chunks.take(4).toList() ?? const <String>[];

    return PageFrame(
      title: 'Study',
      subtitle: 'Generate flashcards, quizzes, notes, and summaries.',
      children: [
        if (items.isEmpty)
          const ActionPanel(
            icon: Icons.school_outlined,
            title: 'No study material yet',
            body: 'Import a document to create review prompts.',
          )
        else
          ...items.map(
            (chunk) => ActionPanel(
              icon: Icons.quiz_outlined,
              title: 'Review prompt',
              body: 'Explain this idea in your own words: ${trimText(chunk, 160)}',
            ),
          ),
        MetricGrid(
          items: [
            MetricItem(label: 'Flashcards', value: '${items.length}'),
            MetricItem(label: 'Quizzes', value: '${items.length}'),
            const MetricItem(label: 'Notes', value: 'Local'),
            const MetricItem(label: 'Reviews', value: 'Ready'),
          ],
        ),
      ],
    );
  }
}

class SettingsPage extends StatelessWidget {
  const SettingsPage({
    required this.learnerAge,
    required this.onLearnerAgeChanged,
    super.key,
  });

  final String learnerAge;
  final ValueChanged<String> onLearnerAgeChanged;

  @override
  Widget build(BuildContext context) {
    return PageFrame(
      title: 'Settings',
      subtitle: 'Local-first privacy and model configuration.',
      children: [
        Card(
          color: const Color(0xFF111827),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: TextField(
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Learner age',
                border: OutlineInputBorder(),
              ),
              controller: TextEditingController(text: learnerAge)
                ..selection = TextSelection.collapsed(offset: learnerAge.length),
              onChanged: onLearnerAgeChanged,
            ),
          ),
        ),
        const SettingsTile(title: 'Telemetry', value: 'Disabled'),
        const SettingsTile(title: 'AI mode', value: 'Topic-focused'),
        const SettingsTile(title: 'Cloud keys', value: 'User-owned only'),
        const SettingsTile(title: 'Mobile voice', value: 'Built-in TTS'),
        const SettingsTile(title: 'Storage', value: 'Local device'),
        const SettingsTile(title: 'Theme', value: 'Dark'),
      ],
    );
  }
}

class PageFrame extends StatelessWidget {
  const PageFrame({
    required this.title,
    required this.subtitle,
    required this.children,
    super.key,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 18),
          ...children.map(
            (child) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

class ActionPanel extends StatelessWidget {
  const ActionPanel({
    required this.icon,
    required this.title,
    required this.body,
    this.trailing,
    super.key,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF111827),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 32, color: const Color(0xFF67E8F9)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 6),
                  Text(body),
                ],
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: 10),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}

class BridgeActionPanel extends StatelessWidget {
  const BridgeActionPanel({
    required this.icon,
    required this.title,
    required this.body,
    required this.buttonLabel,
    required this.onPressed,
    super.key,
  });

  final IconData icon;
  final String title;
  final String body;
  final String buttonLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF111827),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 32, color: const Color(0xFF67E8F9)),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 6),
                      Text(body),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: onPressed,
              child: Text(buttonLabel),
            ),
          ],
        ),
      ),
    );
  }
}

class EchoLearnMark extends StatelessWidget {
  const EchoLearnMark({required this.size, super.key});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        gradient: const LinearGradient(
          colors: [Color(0xFF67E8F9), Color(0xFF22C55E), Color(0xFFBEF264)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Center(
        child: Text(
          'E',
          style: TextStyle(
            color: Color(0xFF0B1020),
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class MetricGrid extends StatelessWidget {
  const MetricGrid({required this.items, super.key});

  final List<MetricItem> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      childAspectRatio: 1.55,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: items,
    );
  }
}

class MetricItem extends StatelessWidget {
  const MetricItem({
    required this.label,
    required this.value,
    super.key,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF111827),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 6),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class SettingsTile extends StatelessWidget {
  const SettingsTile({
    required this.title,
    required this.value,
    super.key,
  });

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF111827),
      child: ListTile(
        title: Text(title),
        trailing: Text(value),
      ),
    );
  }
}

String localTopicAnswer(MobileDocument document, String question, String learnerAge) {
  final questionTerms = usefulTerms(question);
  final scored = document.chunks
      .map(
        (chunk) => (
          chunk: chunk,
          score: questionTerms.where((term) => usefulTerms(chunk).contains(term)).length,
        ),
      )
      .where((item) => item.score > 0)
      .toList()
    ..sort((left, right) => right.score.compareTo(left.score));

  if (questionTerms.isEmpty || scored.isEmpty) {
    return 'This question does not have a strong match with the uploaded document. I can help when the question stays on the same subject or topic as the document.';
  }

  final ageText = learnerAge.trim().isEmpty
      ? 'clearly'
      : 'in a way that fits a ${learnerAge.trim()} year old learner';
  return 'This question matches the document topic. I will explain it $ageText: ${trimText(scored.first.chunk, 420)}';
}

Set<String> usefulTerms(String text) {
  const stopWords = {
    'the',
    'and',
    'for',
    'with',
    'from',
    'this',
    'that',
    'what',
    'how',
    'why',
    'can',
    'you',
    'are',
  };

  return text
      .toLowerCase()
      .split(RegExp(r'[^a-z0-9]+'))
      .where((term) => term.length > 2 && !stopWords.contains(term))
      .toSet();
}

String trimText(String text, int maxLength) {
  return text.length <= maxLength ? text : '${text.substring(0, maxLength)}...';
}
