import AppIntents
internal import ExpoAppIntents

/// «سبّح»: adds one to the tasbih without opening the app, so it can run from Back Tap
/// (Settings → Accessibility → Touch → Back Tap → a shortcut) with the screen dark. The app
/// adds the counts to the current dhikr when it next opens (src/features/siri.ios.ts).
struct TasbihIntent: AppIntent {
  static let title: LocalizedStringResource = "سبّح"
  static let description = IntentDescription("يزيد عدّاد المسبحة واحدًا دون فتح التطبيق")
  static let openAppWhenRun: Bool = false

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "tasbih", params: [:])
    return .result()
  }
}
