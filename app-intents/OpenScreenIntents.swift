import AppIntents
internal import ExpoAppIntents

// Intents that open a screen. JavaScript routes them (src/features/app-intents.ts).

struct OpenQiblaIntent: AppIntent {
  static let title: LocalizedStringResource = "اتجاه القبلة"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["screen": "qibla"])
    return .result()
  }
}

/// Morning adhkar until Asr, evening adhkar after it (decided in the app, which knows the times).
struct OpenAdhkarIntent: AppIntent {
  static let title: LocalizedStringResource = "أذكار الوقت"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["screen": "adhkar"])
    return .result()
  }
}

/// Today's khatma portion, or the mushaf where reading stopped.
struct OpenWirdIntent: AppIntent {
  static let title: LocalizedStringResource = "ورد القرآن"
  static let openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(name: "open", params: ["screen": "wird"])
    return .result()
  }
}
