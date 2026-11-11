package com.bogdanpetrenko.riichinightfx;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The game's own vibration, registered by MainActivity (JS: registerPlugin
 * "RNVibration", src/game/haptics.ts). Phones differ in which vibrations
 * they let through (Xiaomi / Poco on HyperOS silenced @capacitor/haptics),
 * so vibrate() takes a "way": the same buzz tagged as a touch, a
 * notification, an alarm, media, an untagged one-shot, the old API, or the
 * view's haptic feedback. info() reports what the phone says about its motor
 * and settings, for the check in Settings.
 */
@CapacitorPlugin(name = "RNVibration")
public class VibrationPlugin extends Plugin {

    private Vibrator vibrator() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        }
        return (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        Vibrator v = vibrator();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        r.put("hasVibrator", v != null && v.hasVibrator());
        r.put("amplitudeControl", v != null && Build.VERSION.SDK_INT >= 26 && v.hasAmplitudeControl());
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        r.put("ringerMode", am == null ? -1 : am.getRingerMode());
        try {
            r.put("touchFeedback", Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, -1));
        } catch (Exception e) {
            r.put("touchFeedback", -2);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        int ms = call.getInt("duration", 40);
        String way = call.getString("way", "media");
        try {
            if ("view".equals(way)) {
                View view = getBridge().getWebView();
                getActivity().runOnUiThread(() -> view.performHapticFeedback(
                    HapticFeedbackConstants.VIRTUAL_KEY, HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING));
                call.resolve();
                return;
            }
            Vibrator v = vibrator();
            if (v == null || !v.hasVibrator()) {
                call.reject("no vibrator");
                return;
            }
            if ("legacy".equals(way) || Build.VERSION.SDK_INT < 26) {
                v.vibrate(ms);
                call.resolve();
                return;
            }
            VibrationEffect effect = VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE);
            if ("plain".equals(way)) {
                v.vibrate(effect);
            } else if (Build.VERSION.SDK_INT >= 33) {
                v.vibrate(effect, VibrationAttributes.createForUsage(usage33(way)));
            } else {
                v.vibrate(effect, new AudioAttributes.Builder().setUsage(audioUsage(way)).build());
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    private static int usage33(String way) {
        switch (way) {
            case "notification":
                return VibrationAttributes.USAGE_NOTIFICATION;
            case "alarm":
                return VibrationAttributes.USAGE_ALARM;
            case "media":
                return VibrationAttributes.USAGE_MEDIA;
            default:
                return VibrationAttributes.USAGE_TOUCH;
        }
    }

    private static int audioUsage(String way) {
        switch (way) {
            case "notification":
                return AudioAttributes.USAGE_NOTIFICATION;
            case "alarm":
                return AudioAttributes.USAGE_ALARM;
            case "media":
                return AudioAttributes.USAGE_MEDIA;
            default:
                return AudioAttributes.USAGE_ASSISTANCE_SONIFICATION;
        }
    }
}
