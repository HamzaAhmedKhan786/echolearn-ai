import 'package:flutter/material.dart';
import 'services/echolearn_bridge.dart';

void main() {
  runApp(const EchoLearnMobileApp());
}

class EchoLearnMobileApp extends StatelessWidget {
  const EchoLearnMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EchoLearn AI',
      debugShowCheckedModeBanner: false,
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
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(
              label: const Text('Offline'),
              avatar: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF22C55E),
                  shape: BoxShape.circle,
                ),
              ),
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

class LibraryPage extends StatelessWidget {
  const LibraryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const PageFrame(
      title: 'Library',
      subtitle: 'Import private PDF, DOCX, EPUB, and text documents.',
      children: [
        ActionPanel(
          icon: Icons.upload_file,
          title: 'Import document',
          body: 'Desktop extraction is ready; mobile native picker and parser bridges are next.',
        ),
        ActionPanel(
          icon: Icons.integration_instructions,
          title: 'Native bridge contract',
          body: 'MethodChannel echolearn.ai/native is defined for import, TTS, and grounded Q&A.',
        ),
        MetricGrid(
          items: [
            MetricItem(label: 'Documents', value: '0'),
            MetricItem(label: 'Indexed chunks', value: '0'),
            MetricItem(label: 'Models ready', value: '0'),
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
    return const PageFrame(
      title: 'Reader',
      subtitle: 'Read, listen, highlight, and navigate imported content.',
      children: [
        ActionPanel(
          icon: Icons.menu_book,
          title: 'No document loaded',
          body: 'The reader surface is ready for parsed text, bookmarks, sentence highlighting, and TTS playback.',
        ),
      ],
    );
  }
}

class TutorPage extends StatelessWidget {
  const TutorPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const PageFrame(
      title: 'AI Tutor',
      subtitle: 'Ask scoped questions grounded in imported documents.',
      children: [
        ActionPanel(
          icon: Icons.psychology_alt_outlined,
          title: 'Grounded answers',
          body: 'RAG, citations, and hallucination checks will connect after local indexing.',
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
        SettingsTile(title: 'AI mode', value: 'Offline'),
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
