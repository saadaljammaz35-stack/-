package expo.modules.tasbihkeys

import android.view.KeyEvent
import android.view.Window
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * «تسبيح بدون شاشة» on Android: while the counting screen is open, the volume buttons count
 * instead of changing the volume. Only that screen turns this on, and it is off again when the
 * screen closes or the app goes to the background.
 */
class TasbihKeysModule : Module() {
  private var original: Window.Callback? = null

  override fun definition() = ModuleDefinition {
    Name("TasbihKeys")
    Events("onKey")

    Function("start") {
      val activity = appContext.currentActivity ?: return@Function false
      activity.runOnUiThread {
        val window = activity.window
        if (original != null) return@runOnUiThread
        val base = window.callback
        original = base
        window.callback = object : Window.Callback by base {
          override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            val code = event.keyCode
            if (code == KeyEvent.KEYCODE_VOLUME_UP || code == KeyEvent.KEYCODE_VOLUME_DOWN) {
              if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                sendEvent("onKey", mapOf("key" to if (code == KeyEvent.KEYCODE_VOLUME_UP) "up" else "down"))
              }
              return true
            }
            return base.dispatchKeyEvent(event)
          }
        }
      }
      true
    }

    Function("stop") {
      restore()
    }

    OnActivityEntersBackground {
      restore()
    }
  }

  private fun restore() {
    val activity = appContext.currentActivity ?: return
    activity.runOnUiThread {
      original?.let { activity.window.callback = it }
      original = null
    }
  }
}
