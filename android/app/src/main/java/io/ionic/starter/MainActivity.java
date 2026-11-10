package io.ionic.starter;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Lenovo YT-X705F (Android 9): WebView antiguo → pantalla blanca si JS moderno falla.
    WebView.setWebContentsDebuggingEnabled(true);
    if (this.bridge != null && this.bridge.getWebView() != null) {
      WebView webView = this.bridge.getWebView();
      WebSettings settings = webView.getSettings();
      settings.setJavaScriptEnabled(true);
      settings.setDomStorageEnabled(true);
      settings.setDatabaseEnabled(true);
      settings.setMediaPlaybackRequiresUserGesture(false);
      settings.setAllowFileAccess(true);
      settings.setAllowContentAccess(true);
      settings.setLoadWithOverviewMode(true);
      settings.setUseWideViewPort(true);
      settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
    }
  }
}
