import AppIntents

/// The phrases Siri, Spotlight and the Shortcuts app offer. Every phrase must name the app;
/// the app's language is Arabic, with an English phrase for the next prayer.
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NextPrayerIntent(),
      phrases: [
        "الصلاة القادمة في \(.applicationName)",
        "متى الصلاة في \(.applicationName)",
        "\(.applicationName) متى الأذان",
        "Next prayer in \(.applicationName)"
      ],
      shortTitle: "الصلاة القادمة",
      systemImageName: "clock.fill"
    )
    AppShortcut(
      intent: OpenQiblaIntent(),
      phrases: [
        "القبلة في \(.applicationName)",
        "اتجاه القبلة في \(.applicationName)"
      ],
      shortTitle: "القبلة",
      systemImageName: "location.north.circle.fill"
    )
    AppShortcut(
      intent: OpenAdhkarIntent(),
      phrases: [
        "الأذكار في \(.applicationName)",
        "أذكاري في \(.applicationName)"
      ],
      shortTitle: "الأذكار",
      systemImageName: "sparkles"
    )
    AppShortcut(
      intent: OpenWirdIntent(),
      phrases: [
        "وردي في \(.applicationName)",
        "ورد القرآن في \(.applicationName)"
      ],
      shortTitle: "ورد القرآن",
      systemImageName: "book.fill"
    )
  }
}
