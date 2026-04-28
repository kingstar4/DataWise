package expo.modules.usageaccess

import android.app.AppOpsManager
import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.BitmapDrawable
import android.net.ConnectivityManager
import android.os.Process
import android.telephony.TelephonyManager
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.Calendar

class UsageAccessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("UsageAccess")

    // ── Synchronous: check if the app has USAGE_STATS permission ──
    Function("hasUsageAccess") {
      val context = appContext.reactContext ?: return@Function false
      hasUsageStatsPermission(context)
    }

    // ── Synchronous: launch the Android Usage Access settings screen ──
    Function("openUsageAccessSettings") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      null
    }

    // ── Synchronous: get the mobile network carrier name ──
    Function("getCarrierName") {
      val context = appContext.reactContext ?: return@Function ""
      val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
      val name = tm?.networkOperatorName
      if (name.isNullOrBlank()) "" else name
    }

    // ── Async: query today's screen-time usage stats ──
    AsyncFunction("getTodayUsageStats") {
      val context = appContext.reactContext
        ?: return@AsyncFunction emptyList<Map<String, Any>>()

      if (!hasUsageStatsPermission(context)) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

      val calendar = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val startTime = calendar.timeInMillis
      val endTime = System.currentTimeMillis()

      val stats: List<UsageStats> =
        usageStatsManager.queryUsageStats(
          UsageStatsManager.INTERVAL_DAILY, startTime, endTime
        ) ?: emptyList()

      val pm = context.packageManager

      stats
        .filter { it.totalTimeInForeground > 0 }
        .sortedByDescending { it.totalTimeInForeground }
        .map { stat ->
          val appName = try {
            val appInfo = pm.getApplicationInfo(stat.packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
          } catch (e: PackageManager.NameNotFoundException) {
            stat.packageName
          }

          mapOf(
            "packageName" to stat.packageName,
            "appName" to appName,
            "totalMinutes" to (stat.totalTimeInForeground / 60_000).toInt()
          )
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // ── Per-app network data usage (bytes) with app icons ──
    // ════════════════════════════════════════════════════════════════════
    AsyncFunction("getDataUsageStats") { period: String ->
      val context = appContext.reactContext
        ?: return@AsyncFunction emptyList<Map<String, Any>>()

      if (!hasUsageStatsPermission(context)) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val (startTime, endTime) = getTimeRange(period)
      val networkStatsManager =
        context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
      val pm = context.packageManager

      data class AppAccum(
        var mobileRxBytes: Long = 0,
        var mobileTxBytes: Long = 0,
        var wifiRxBytes: Long = 0,
        var wifiTxBytes: Long = 0,
        var foregroundBytes: Long = 0,
        var backgroundBytes: Long = 0
      )

      val uidMap = mutableMapOf<Int, AppAccum>()

      // Query all network types: mobile, wifi, and ethernet (for emulator support)
      val networkTypes = intArrayOf(
        ConnectivityManager.TYPE_MOBILE,
        ConnectivityManager.TYPE_WIFI,
        9 // ConnectivityManager.TYPE_ETHERNET (constant value = 9)
      )

      for (networkType in networkTypes) {
        try {
          val stats = networkStatsManager.querySummary(
            networkType, null, startTime, endTime
          )
          val bucket = NetworkStats.Bucket()
          while (stats.hasNextBucket()) {
            stats.getNextBucket(bucket)
            val uid = bucket.uid
            if (uid < 0) continue
            val accum = uidMap.getOrPut(uid) { AppAccum() }

            when (networkType) {
              ConnectivityManager.TYPE_MOBILE -> {
                accum.mobileRxBytes += bucket.rxBytes
                accum.mobileTxBytes += bucket.txBytes
              }
              else -> {
                // Wi-Fi and Ethernet both count as "wifi" for the user
                accum.wifiRxBytes += bucket.rxBytes
                accum.wifiTxBytes += bucket.txBytes
              }
            }

            if (bucket.state == NetworkStats.Bucket.STATE_FOREGROUND) {
              accum.foregroundBytes += bucket.rxBytes + bucket.txBytes
            } else {
              accum.backgroundBytes += bucket.rxBytes + bucket.txBytes
            }
          }
          stats.close()
        } catch (_: Exception) {}
      }

      // Resolve UID → package name → app name + icon, sort by totalBytes
      uidMap.entries
        .mapNotNull { (uid, accum) ->
          val packages = pm.getPackagesForUid(uid) ?: return@mapNotNull null
          val pkgName = packages.firstOrNull() ?: return@mapNotNull null
          val appName = try {
            val appInfo = pm.getApplicationInfo(pkgName, 0)
            pm.getApplicationLabel(appInfo).toString()
          } catch (_: PackageManager.NameNotFoundException) {
            pkgName
          }
          val totalBytes = accum.mobileRxBytes + accum.mobileTxBytes +
                           accum.wifiRxBytes + accum.wifiTxBytes

          if (totalBytes == 0L) return@mapNotNull null

          // Extract app icon as base64 PNG
          val iconBase64 = getAppIconBase64(pm, pkgName)

          mapOf(
            "packageName" to pkgName,
            "appName" to appName,
            "mobileRxBytes" to accum.mobileRxBytes,
            "mobileTxBytes" to accum.mobileTxBytes,
            "wifiRxBytes" to accum.wifiRxBytes,
            "wifiTxBytes" to accum.wifiTxBytes,
            "foregroundBytes" to accum.foregroundBytes,
            "backgroundBytes" to accum.backgroundBytes,
            "totalBytes" to totalBytes,
            "iconBase64" to iconBase64
          )
        }
        .sortedByDescending { it["totalBytes"] as Long }
    }

    // ════════════════════════════════════════════════════════════════════
    // ── Daily data totals for bar chart ──
    // ════════════════════════════════════════════════════════════════════
    AsyncFunction("getDailyDataUsage") { days: Int ->
      val context = appContext.reactContext
        ?: return@AsyncFunction emptyList<Map<String, Any>>()

      if (!hasUsageStatsPermission(context)) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val networkStatsManager =
        context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager

      val results = mutableListOf<Map<String, Any>>()
      val dayNames = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
      val networkTypes = intArrayOf(
        ConnectivityManager.TYPE_MOBILE,
        ConnectivityManager.TYPE_WIFI,
        9
      )

      for (i in (days - 1) downTo 0) {
        val dayStart = Calendar.getInstance().apply {
          add(Calendar.DAY_OF_YEAR, -i)
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        val dayEnd = Calendar.getInstance().apply {
          timeInMillis = dayStart.timeInMillis
          set(Calendar.HOUR_OF_DAY, 23)
          set(Calendar.MINUTE, 59)
          set(Calendar.SECOND, 59)
          set(Calendar.MILLISECOND, 999)
        }

        val endMs = minOf(dayEnd.timeInMillis, System.currentTimeMillis())
        val startMs = dayStart.timeInMillis

        var mobileTotal = 0L
        var wifiTotal = 0L

        for (networkType in networkTypes) {
          try {
            val stats = networkStatsManager.querySummary(
              networkType, null, startMs, endMs
            )
            val bucket = NetworkStats.Bucket()
            while (stats.hasNextBucket()) {
              stats.getNextBucket(bucket)
              if (bucket.uid >= 0) {
                val bytes = bucket.rxBytes + bucket.txBytes
                if (networkType == ConnectivityManager.TYPE_MOBILE) {
                  mobileTotal += bytes
                } else {
                  wifiTotal += bytes
                }
              }
            }
            stats.close()
          } catch (_: Exception) {}
        }

        val dayLabel = dayNames[dayStart.get(Calendar.DAY_OF_WEEK) - 1]

        results.add(mapOf(
          "label" to dayLabel,
          "totalBytes" to (mobileTotal + wifiTotal),
          "mobileBytes" to mobileTotal,
          "wifiBytes" to wifiTotal
        ))
      }

      results
    }

    // ════════════════════════════════════════════════════════════════════
    // ── Peak hours usage for time-of-day breakdown ──
    // ════════════════════════════════════════════════════════════════════
    AsyncFunction("getPeakHoursUsage") { period: String ->
      val context = appContext.reactContext
        ?: return@AsyncFunction emptyList<Map<String, Any>>()

      if (!hasUsageStatsPermission(context)) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }

      val (periodStart, periodEnd) = getTimeRange(period)
      val networkStatsManager =
        context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager

      data class TimeWindow(
        val name: String,
        val timeLabel: String,
        val startHour: Int,
        val endHour: Int,
        var totalBytes: Long = 0
      )

      val windows = listOf(
        TimeWindow("Morning", "6 AM – 12 PM", 6, 12),
        TimeWindow("Afternoon", "12 PM – 6 PM", 12, 18),
        TimeWindow("Evening", "6 PM – 12 AM", 18, 24),
        TimeWindow("Night", "12 AM – 6 AM", 0, 6)
      )

      val networkTypes = intArrayOf(
        ConnectivityManager.TYPE_MOBILE,
        ConnectivityManager.TYPE_WIFI,
        9
      )

      val cal = Calendar.getInstance().apply { timeInMillis = periodStart }
      val endCal = Calendar.getInstance().apply { timeInMillis = periodEnd }

      while (cal.before(endCal)) {
        for (window in windows) {
          val windowStart = Calendar.getInstance().apply {
            timeInMillis = cal.timeInMillis
            set(Calendar.HOUR_OF_DAY, window.startHour)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
          }
          val windowEnd = Calendar.getInstance().apply {
            timeInMillis = cal.timeInMillis
            if (window.endHour == 24) {
              set(Calendar.HOUR_OF_DAY, 23)
              set(Calendar.MINUTE, 59)
              set(Calendar.SECOND, 59)
              set(Calendar.MILLISECOND, 999)
            } else {
              set(Calendar.HOUR_OF_DAY, window.endHour)
              set(Calendar.MINUTE, 0)
              set(Calendar.SECOND, 0)
              set(Calendar.MILLISECOND, 0)
            }
          }

          val wStart = maxOf(windowStart.timeInMillis, periodStart)
          val wEnd = minOf(windowEnd.timeInMillis, periodEnd, System.currentTimeMillis())

          if (wStart >= wEnd) continue

          for (networkType in networkTypes) {
            try {
              val stats = networkStatsManager.querySummary(
                networkType, null, wStart, wEnd
              )
              val bucket = NetworkStats.Bucket()
              while (stats.hasNextBucket()) {
                stats.getNextBucket(bucket)
                if (bucket.uid >= 0) {
                  window.totalBytes += bucket.rxBytes + bucket.txBytes
                }
              }
              stats.close()
            } catch (_: Exception) {}
          }
        }
        cal.add(Calendar.DAY_OF_YEAR, 1)
      }

      windows.map { w ->
        mapOf(
          "period" to w.name,
          "time" to w.timeLabel,
          "totalBytes" to w.totalBytes
        )
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private fun hasUsageStatsPermission(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /**
   * Extract an app's icon as a base64-encoded PNG string.
   * Returns empty string if the icon cannot be loaded.
   */
  private fun getAppIconBase64(pm: PackageManager, packageName: String): String {
    return try {
      val drawable = pm.getApplicationIcon(packageName)
      val bitmap = when (drawable) {
        is BitmapDrawable -> drawable.bitmap
        is AdaptiveIconDrawable -> {
          val bmp = Bitmap.createBitmap(
            drawable.intrinsicWidth.coerceAtLeast(1),
            drawable.intrinsicHeight.coerceAtLeast(1),
            Bitmap.Config.ARGB_8888
          )
          val canvas = Canvas(bmp)
          drawable.setBounds(0, 0, canvas.width, canvas.height)
          drawable.draw(canvas)
          bmp
        }
        else -> {
          val bmp = Bitmap.createBitmap(
            drawable.intrinsicWidth.coerceAtLeast(1),
            drawable.intrinsicHeight.coerceAtLeast(1),
            Bitmap.Config.ARGB_8888
          )
          val canvas = Canvas(bmp)
          drawable.setBounds(0, 0, canvas.width, canvas.height)
          drawable.draw(canvas)
          bmp
        }
      }

      // Scale down to 48x48 to keep payload small
      val scaled = Bitmap.createScaledBitmap(bitmap, 48, 48, true)
      val stream = ByteArrayOutputStream()
      scaled.compress(Bitmap.CompressFormat.PNG, 80, stream)
      val bytes = stream.toByteArray()
      Base64.encodeToString(bytes, Base64.NO_WRAP)
    } catch (_: Exception) {
      ""
    }
  }

  /**
   * Compute the (startTime, endTime) range for a given period string.
   */
  private fun getTimeRange(period: String): Pair<Long, Long> {
    val endTime = System.currentTimeMillis()
    val cal = Calendar.getInstance()

    when (period.lowercase()) {
      "today" -> {
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
      }
      "week" -> {
        cal.set(Calendar.DAY_OF_WEEK, cal.firstDayOfWeek)
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
      }
      "month" -> {
        cal.set(Calendar.DAY_OF_MONTH, 1)
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
      }
      else -> {
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
      }
    }

    return Pair(cal.timeInMillis, endTime)
  }
}