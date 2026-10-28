package expo.modules.livecountdown

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The live prayer countdown on Android: an ongoing, silent notification whose chronometer counts
 * down to the next prayer. The app hands over the coming prayers; an alarm at each prayer time
 * moves the notification on to the next one without the app running.
 */
class LiveCountdownModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LiveCountdown")

    // entries: [{ at: ms, title, text }], soonest first; channelName: the channel's visible name.
    Function("schedule") { entries: List<Map<String, Any?>>, channelName: String ->
      val parsed = entries.mapNotNull { e ->
        (e["at"] as? Number)?.toLong()?.let { at -> LiveCountdown.Entry(at, e["title"] as? String ?: "", e["text"] as? String ?: "") }
      }
      appContext.reactContext?.let { context ->
        LiveCountdown.save(context, parsed, channelName)
        LiveCountdown.refresh(context)
      }
    }

    Function("stop") {
      appContext.reactContext?.let { LiveCountdown.clear(it) }
    }
  }
}
