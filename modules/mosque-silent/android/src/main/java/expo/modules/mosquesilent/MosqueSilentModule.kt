package expo.modules.mosquesilent

import android.app.NotificationManager
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * «صامت في المسجد» on Android: Do Not Disturb (priority only) from just before each iqama until
 * the prayer is over. The app hands over the coming windows; alarms switch it on and off without
 * the app running. It needs the user to grant Do Not Disturb access once.
 */
class MosqueSilentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MosqueSilent")

    Function("hasAccess") {
      val context = appContext.reactContext ?: return@Function false
      context.getSystemService(NotificationManager::class.java).isNotificationPolicyAccessGranted
    }

    Function("openAccessSettings") {
      appContext.reactContext?.let { context ->
        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    // windows: [{ start: ms, end: ms, label }]; text: the notification shown while silent ("%s" = end time).
    Function("schedule") { windows: List<Map<String, Any?>>, channelName: String, text: String ->
      val parsed = windows.mapNotNull { w ->
        val start = (w["start"] as? Number)?.toLong()
        val end = (w["end"] as? Number)?.toLong()
        if (start != null && end != null && end > start) MosqueSilent.Window(start, end, w["label"] as? String ?: "") else null
      }
      appContext.reactContext?.let { context ->
        MosqueSilent.save(context, parsed, channelName, text)
        MosqueSilent.refresh(context)
      }
    }

    Function("stop") {
      appContext.reactContext?.let { MosqueSilent.clear(it) }
    }
  }
}
