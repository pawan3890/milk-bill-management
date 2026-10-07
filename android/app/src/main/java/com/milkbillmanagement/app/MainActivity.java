package com.milkbillmanagement.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        holdOpeningScreen();
        super.onCreate(savedInstanceState);
        keepClearOfSystemBars();
        lockSize();
    }

    // Keep the logo opening screen up until the app has drawn its first page (the page sets
    // window.DMS_READY), at most 6 seconds, so the logo goes straight to the app.
    private volatile boolean pageReady = false;
    private volatile boolean pageDrawn = false;
    private long lastAsked = 0;

    private void holdOpeningScreen() {
        final long started = SystemClock.uptimeMillis();
        SplashScreen.installSplashScreen(this).setKeepOnScreenCondition(() -> {
            long now = SystemClock.uptimeMillis();
            if (pageDrawn || now - started > 6000) return false;
            final WebView webView = getBridge() == null ? null : getBridge().getWebView();
            if (webView == null || pageReady || now - lastAsked < 100) return true;
            lastAsked = now;
            webView.evaluateJavascript("window.DMS_READY === true", value -> {
                if (!"true".equals(value) || pageReady) return;
                pageReady = true;
                webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                    @Override
                    public void onComplete(long requestId) {
                        pageDrawn = true;
                    }
                });
            });
            return true;
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        styleSystemBars();
    }

    // The app sits between the phone's status bar (time, battery) and its navigation
    // buttons on every Android version, so nothing is drawn underneath them.
    private void keepClearOfSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.getDecorView().setBackgroundColor(Color.WHITE);

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboard = insets.isVisible(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, keyboard ? Math.max(ime.bottom, bars.bottom) : bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(content);
        styleSystemBars();
    }

    // White bars with dark time, battery and navigation icons.
    @SuppressWarnings("deprecation")
    private void styleSystemBars() {
        Window window = getWindow();
        window.getDecorView().setBackgroundColor(Color.WHITE);
        if (Build.VERSION.SDK_INT < 35) {
            window.setStatusBarColor(Color.WHITE);
            window.setNavigationBarColor(Color.WHITE);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
    }

    // Keep the app at one fixed size: ignore the phone's font-size setting and block zooming.
    private void lockSize() {
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
    }
}
