import 'package:echolearn_ai/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders EchoLearn mobile shell', (WidgetTester tester) async {
    await tester.pumpWidget(const EchoLearnMobileApp());

    expect(find.text('EchoLearn AI'), findsOneWidget);
    expect(find.text('Library'), findsWidgets);
    expect(find.text('Import document'), findsOneWidget);
  });
}
