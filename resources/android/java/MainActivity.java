package com.bogdanpetrenko.riichinightfx;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Full-screen game: the status bar and the navigation bar are hidden
 * (immersive; a swipe from the edge shows them for a moment), and the page
 * also draws under the camera cutout, so there is no grey stripe at the
 * side in landscape. The page keeps its controls clear of the cutout with
 * CSS env(safe-area-inset-*). Also registers the game's vibration
 * (VibrationPlugin). Copied over the generated activity by CI, with the
 * other files of resources/android/java (.github/workflows/android.yml).
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The game's own vibration (VibrationPlugin), before the bridge starts.
        registerPlugin(VibrationPlugin.class);
        super.onCreate(savedInstanceState);
        goFullScreen();
    }

    @Override
    public void onResume() {
        super.onResume();
        goFullScreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goFullScreen();
    }

    private void goFullScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
