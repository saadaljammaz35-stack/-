package expo.modules.livecountdown

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject

internal object LiveCountdown {
  data class Entry(val at: Long, val title: String, val text: String)

  private const val PREFS = "maallah_live_countdown"
  private const val CHANNEL = "live-countdown"
  private const val NOTIFICATION_ID = 7310
  private const val DEEP_LINK = "maallah://prayer"

  fun save(context: Context, entries: List<Entry>, channelName: String) {
    val list = JSONArray()
    entries.forEach { list.put(JSONObject().put("at", it.at).put("title", it.title).put("text", it.text)) }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("entries", list.toString())
      .putString("channelName", channelName)
      .apply()
  }

  fun clear(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    alarmManager(context).cancel(alarmIntent(context))
  }

  /** Shows the countdown to the next saved prayer and sets the alarm for when it comes. */
  fun refresh(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val raw = prefs.getString("entries", null) ?: return
    val now = System.currentTimeMillis()
    val next = parse(raw).firstOrNull { it.at > now + 1000 }
    val manager = NotificationManagerCompat.from(context)
    if (next == null) {
      manager.cancel(NOTIFICATION_ID)
      return
    }
    ensureChannel(context, prefs.getString("channelName", null) ?: "Prayer countdown")
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(next.title)
      .setContentText(next.text)
      .setWhen(next.at)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      // Gone at the prayer time itself, when the adhan takes over; the alarm brings the next one.
      .setTimeoutAfter(next.at - now)
      .setContentIntent(openApp(context))
      .build()
    if (manager.areNotificationsEnabled()) {
      try {
        manager.notify(NOTIFICATION_ID, notification)
      } catch (_: SecurityException) {
        // Notification permission withdrawn.
      }
    }
    scheduleAlarm(context, next.at + 1000)
  }

  private fun parse(raw: String): List<Entry> {
    val list = JSONArray(raw)
    return (0 until list.length()).map {
      val o = list.getJSONObject(it)
      Entry(o.getLong("at"), o.optString("title"), o.optString("text"))
    }.sortedBy { it.at }
  }

  private fun ensureChannel(context: Context, name: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_LOW).apply {
      setShowBadge(false)
      setSound(null, null)
      enableVibration(false)
    }
    nm.createNotificationChannel(channel)
  }

  private fun scheduleAlarm(context: Context, at: Long) {
    val am = alarmManager(context)
    val pi = alarmIntent(context)
    // A non-waking alarm: while the screen is off nothing needs to change.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
      am.setExact(AlarmManager.RTC, at, pi)
    } else {
      am.setWindow(AlarmManager.RTC, at, 60_000, pi)
    }
  }

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun alarmIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, LiveCountdownReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun openApp(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK)).setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun smallIcon(context: Context): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }
}
