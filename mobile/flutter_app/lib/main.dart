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

  static const pages = [
    LibraryPage(),
    ReaderPage(),
    TutorPage(),
    StudyPage(),
    SettingsPage(),
  ];

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

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key});

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  String status = 'No document imported yet.';

  Future<void> importDocument() async {
    try {
      final document = await mobileBridge.pickAndImportDocument();
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
        const MetricGrid(
          items: [
            MetricItem(label: 'Documents', value: '0'),
            MetricItem(label: 'Ready chunks', value: '0'),
            MetricItem(label: 'Chats saved', value: '0'),
            MetricItem(label: 'Study items', value: '0'),
          ],
        ),
      ],
    );
  }
}

const mobileBridge = EchoLearnBridge();

class ReaderPage extends StatelessWidget {
  const ReaderPage({super.key});

  @override
  Widget build(BuildContext context) {
    return PageFrame(
      title: 'Reader',
      subtitle: 'Read, listen, highlight, and navigate imported content.',
      children: [
        BridgeActionPanel(
          icon: Icons.volume_up_outlined,
          title: 'Read aloud',
          body: 'Uses built-in Android or iOS voices so mobile reading stays light and on-device.',
          buttonLabel: 'Speak',
          onPressed: () => mobileBridge.speak('EchoLearn mobile text to speech is connected.'),
        ),
      ],
    );
  }
}

class TutorPage extends StatefulWidget {
  const TutorPage({super.key});

  @override
  State<TutorPage> createState() => _TutorPageState();
}

class _TutorPageState extends State<TutorPage> {
  String answer = 'Ask a question about the uploaded document topic.';

  Future<void> askQuestion() async {
    try {
      final response = await mobileBridge.askQuestion(
        documentId: 'mobile-preview',
        question: 'What is EchoLearn?',
        scope: 'Whole document',
      );
      setState(() => answer = response.answer);
    } catch (error) {
      setState(() => answer = 'Tutor is not available on this device yet: $error');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PageFrame(
      title: 'AI Tutor',
      subtitle: 'Ask questions that stay focused on the uploaded document topic.',
      children: [
        BridgeActionPanel(
          icon: Icons.psychology_alt_outlined,
          title: 'Topic-focused answers',
          body: answer,
          buttonLabel: 'Ask',
          onPressed: askQuestion,
        ),
      ],
    );
  }
}

class StudyPage extends StatelessWidget {
  const StudyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const PageFrame(
      title: 'Study',
      subtitle: 'Generate flashcards, quizzes, notes, and summaries.',
      children: [
        MetricGrid(
          items: [
            MetricItem(label: 'Flashcards', value: '0'),
            MetricItem(label: 'Quizzes', value: '0'),
            MetricItem(label: 'Notes', value: '0'),
            MetricItem(label: 'Reviews', value: '0'),
          ],
        ),
      ],
    );
  }
}

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const PageFrame(
      title: 'Settings',
      subtitle: 'Local-first privacy and model configuration.',
      children: [
        SettingsTile(title: 'Telemetry', value: 'Disabled'),
        SettingsTile(title: 'AI mode', value: 'Topic-focused'),
        SettingsTile(title: 'Cloud keys', value: 'User-owned only'),
        SettingsTile(title: 'Mobile voice', value: 'Built-in TTS'),
        SettingsTile(title: 'Storage', value: 'Local encrypted'),
        SettingsTile(title: 'Theme', value: 'Dark'),
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
    super.key,
  });

  final IconData icon;
  final String title;
  final String body;

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
