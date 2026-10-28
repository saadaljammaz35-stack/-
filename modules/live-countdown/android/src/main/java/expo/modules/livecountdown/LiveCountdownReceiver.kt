package expo.modules.livecountdown

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fired at each prayer time, after a reboot and after an app update. */
class LiveCountdownReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    LiveCountdown.refresh(context)
  }
}
