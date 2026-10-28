import AppIntents
import Foundation

/// «الصلاة القادمة»: Siri answers from the prayer timeline the app keeps for its widgets
/// (src/features/widgets/update.ts), without opening the app.
struct NextPrayerIntent: AppIntent {
  static let title: LocalizedStringResource = "الصلاة القادمة"
  static let description = IntentDescription("موعد الصلاة القادمة والوقت المتبقي عليها")
  static let openAppWhenRun: Bool = false

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    let now = Date()
    guard let next = UpcomingPrayer.find(after: now) else {
      return .result(dialog: "افتح «مع الله» مرة لتحديد مدينتك، ثم اسألني مجددًا.")
    }
    return .result(dialog: IntentDialog(stringLiteral: next.sentence(now: now)))
  }
}

/// The next prayer in the widget timeline stored in the app group.
struct UpcomingPrayer {
  let name: String
  let time: String
  let at: Date
  let english: Bool

  static func find(after now: Date) -> UpcomingPrayer? {
    let group = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
    guard let defaults = UserDefaults(suiteName: group),
          let timeline = defaults.array(forKey: "__expo_widgets_PrayerWidget_timeline") as? [[String: Any]]
    else { return nil }
    let prayers = timeline.compactMap { entry -> UpcomingPrayer? in
      guard let props = entry["props"] as? [String: Any],
            let next = props["next"] as? [String: Any],
            let name = next["name"] as? String,
            let time = next["time"] as? String,
            let at = (next["at"] as? NSNumber)?.doubleValue
      else { return nil }
      return UpcomingPrayer(name: name, time: time, at: Date(timeIntervalSince1970: at / 1000), english: (props["lang"] as? String) == "en")
    }
    return prayers.filter { $0.at > now }.min { $0.at < $1.at }
  }

  func sentence(now: Date) -> String {
    let minutes = max(1, Int((at.timeIntervalSince(now) / 60).rounded(.up)))
    let h = minutes / 60
    let m = minutes % 60
    if english {
      let rel = [h > 0 ? "\(h) h" : nil, m > 0 ? "\(m) min" : nil].compactMap { $0 }.joined(separator: " ")
      return "\(name) is at \(time), in \(rel)."
    }
    let rel = [h > 0 ? Self.hours(h) : nil, m > 0 ? Self.minutes(m) : nil].compactMap { $0 }.joined(separator: " و")
    return "صلاة \(name) الساعة \(time)، بعد \(rel)."
  }

  private static func hours(_ n: Int) -> String {
    n == 1 ? "ساعة" : n == 2 ? "ساعتين" : n <= 10 ? "\(n) ساعات" : "\(n) ساعة"
  }

  private static func minutes(_ n: Int) -> String {
    n == 1 ? "دقيقة" : n == 2 ? "دقيقتين" : n <= 10 ? "\(n) دقائق" : "\(n) دقيقة"
  }
}
