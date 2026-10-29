package expo.modules.mosquesilent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fired at the start and end of each prayer window, after a reboot and after an app update. */
class MosqueSilentReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    MosqueSilent.refresh(context)
  }
}
