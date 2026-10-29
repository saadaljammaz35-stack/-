package expo.modules.mosquesilent

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
import java.text.DateFormat
import java.util.Date

internal object MosqueSilent {
  data class Window(val start: Long, val end: Long, val label: String)

  private const val PREFS = "maallah_mosque_silent"
  private const val CHANNEL = "mosque-silent"
  private const val NOTIFICATION_ID = 7311
  private const val DEEP_LINK = "maallah://mosque-silent"

  fun save(context: Context, windows: List<Window>, channelName: String, text: String) {
    val list = JSONArray()
    windows.forEach { list.put(JSONObject().put("start", it.start).put("end", it.end).put("label", it.label)) }
    prefs(context).edit()
      .putString("windows", list.toString())
      .putString("channelName", channelName)
      .putString("text", text)
      .apply()
  }

  fun clear(context: Context) {
    restore(context)
    prefs(context).edit().remove("windows").apply()
    alarmManager(context).cancel(alarmIntent(context))
  }

  /** Silences the phone inside a window, restores it outside, and sets the alarm for the next change. */
  fun refresh(context: Context) {
    val raw = prefs(context).getString("windows", null) ?: return
    val now = System.currentTimeMillis()
    val windows = parse(raw)
    val current = windows.firstOrNull { now >= it.start && now < it.end }
    if (current != null) silence(context, current) else restore(context)
    val next = windows.flatMap { listOf(it.start, it.end) }.filter { it > now + 500 }.minOrNull() ?: return
    scheduleAlarm(context, next)
  }

  private fun silence(context: Context, window: Window) {
    val nm = context.getSystemService(NotificationManager::class.java)
    if (!nm.isNotificationPolicyAccessGranted) return
    val p = prefs(context)
    // Leave the phone alone if the user already chose a Do Not Disturb mode themselves.
    if (!p.getBoolean("silenced", false)) {
      if (nm.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL) return
      nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
      p.edit().putBoolean("silenced", true).apply()
    }
    notify(context, window)
  }

  private fun restore(context: Context) {
    val p = prefs(context)
    if (!p.getBoolean("silenced", false)) return
    val nm = context.getSystemService(NotificationManager::class.java)
    // Only undo our own change: if the user has switched modes since, theirs stands.
    if (nm.isNotificationPolicyAccessGranted && nm.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_PRIORITY) {
      nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
    }
    p.edit().putBoolean("silenced", false).apply()
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  private fun notify(context: Context, window: Window) {
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    ensureChannel(context, prefs(context).getString("channelName", null) ?: "Silent at the mosque")
    val until = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(window.end))
    val text = (prefs(context).getString("text", null) ?: "%s").replace("%s", until)
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(window.label)
      .setContentText(text)
      .setOngoing(true)
      .setSilent(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setTimeoutAfter(window.end - System.currentTimeMillis())
      .setContentIntent(openApp(context))
      .build()
    try {
      manager.notify(NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // Notification permission withdrawn.
    }
  }

  private fun parse(raw: String): List<Window> {
    val list = JSONArray(raw)
    return (0 until list.length()).map {
      val o = list.getJSONObject(it)
      Window(o.getLong("start"), o.getLong("end"), o.optString("label"))
    }.sortedBy { it.start }
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
    // Waking: the phone is usually locked on the way to the mosque.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    } else {
      am.setWindow(AlarmManager.RTC_WAKEUP, at, 60_000, pi)
    }
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun alarmIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, MosqueSilentReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun openApp(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK)).setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(context, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun smallIcon(context: Context): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }
}
