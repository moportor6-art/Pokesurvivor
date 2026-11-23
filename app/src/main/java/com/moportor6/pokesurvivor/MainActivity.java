package com.moportor6.pokesurvivor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * PokéSurvivor Offline.
 * El juego (la web de pokesurvivor.com, completa) va dentro de la app en assets/www y se sirve en
 * https://pokesurvivor.offline/ — así el navegador lo trata como sitio seguro y guarda la partida en el teléfono.
 * Nada del juego sale a internet: cualquier petición a otro sitio se corta aquí mismo.
 * Lo único que usa la red es el actualizador (Updater), que habla con GitHub.
 */
public class MainActivity extends Activity {

    static final String HOST = "pokesurvivor.offline";
    private static final String HOME = "https://" + HOST + "/";
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("gif", "image/gif");
        MIME.put("webp", "image/webp");
        MIME.put("svg", "image/svg+xml");
        MIME.put("ico", "image/x-icon");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("ogg", "audio/ogg");
        MIME.put("wav", "audio/wav");
        MIME.put("woff2", "font/woff2");
        MIME.put("woff", "font/woff");
        MIME.put("ttf", "font/ttf");
        MIME.put("txt", "text/plain");
    }

    private WebView web;
    private Updater updater;
    private boolean backDialogOpen = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            w.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web);
        hideSystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 // localStorage: la partida guardada
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // música y gritos
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);                           // que la letra grande del sistema no rompa la interfaz
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setSupportMultipleWindows(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);    // siempre lo de la app / la actualización activa

        updater = new Updater(this, web);   // antes de cargar: decide de dónde sale cada archivo del juego
        web.addJavascriptInterface(new Bridge(), "PSNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serve(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                // Todo en local: ningún enlace sale de la app (ni al navegador ni a otra página)
                return !isLocal(req.getUrl());
            }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, new OnBackInvokedCallback() {
                        @Override
                        public void onBackInvoked() { handleBack(); }
                    });
        }

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(HOME);
        web.postDelayed(() -> updater.check(false), 5000);   // busca actualizaciones al abrir (sin internet, nada)
    }

    /** Puente con la capa local del juego (www/local.js). */
    private class Bridge {
        @JavascriptInterface public String updInfo() { return updater.info(); }
        @JavascriptInterface public void updCheck() { runOnUiThread(() -> updater.check(true)); }
        @JavascriptInterface public void updReset() { updater.reset(); }
        @JavascriptInterface public void updBooted() { updater.booted(); }
    }

    private static boolean isLocal(Uri u) {
        return HOST.equals(u.getHost());
    }

    /** Sirve el juego desde assets/www (o desde la actualización activa). Lo externo se corta: sin internet. */
    private WebResourceResponse serve(Uri u) {
        String scheme = u.getScheme();
        if (scheme != null && (scheme.equals("data") || scheme.equals("blob"))) return null;
        if (!isLocal(u)) return notFound();
        String path = u.getPath();
        if (path == null || path.isEmpty() || path.endsWith("/")) path = (path == null ? "/" : path) + "index.html";
        if (path.contains("..")) return notFound();
        String rel = path.substring(1);
        if (updater != null) {   // archivos actualizados (Updater) antes que los de la APK
            if (updater.isRemoved(rel)) return notFound();
            File upd = updater.overlayFile(rel);
            if (upd != null) {
                try { return response(path, new FileInputStream(upd)); } catch (IOException e) { /* sigue con la APK */ }
            }
        }
        try {
            return response(path, getAssets().open("www/" + rel, AssetManager.ACCESS_STREAMING));
        } catch (IOException e) {
            return path.endsWith(".html") ? offlinePage() : notFound();
        }
    }

    /** Página que no viene en la copia (apoyo, contacto...): aviso y vuelta al juego. */
    private static WebResourceResponse offlinePage() {
        String html = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                + "<body style='margin:0;background:#16214a;color:#eef2ff;font:18px system-ui;display:grid;place-items:center;min-height:100vh'>"
                + "<div style='text-align:center;padding:24px'><p>Esta página no está en la edición sin internet.</p>"
                + "<p><a href='/' style='color:#ffd23f'>Volver al juego</a></p></div>";
        WebResourceResponse r = new WebResourceResponse("text/html", "utf-8", new ByteArrayInputStream(html.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }

    private static WebResourceResponse response(String path, InputStream in) {
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        WebResourceResponse r = new WebResourceResponse(mime,
                mime.startsWith("text/") || mime.endsWith("json") ? "utf-8" : null, in);
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");
        headers.put("Access-Control-Allow-Origin", "*");
        r.setResponseHeaders(headers);
        return r;
    }

    private static WebResourceResponse notFound() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }

    /** Atrás: en partida pausa; en una ventana la cierra; en el menú pregunta si salir. Lo decide local.js. */
    private void handleBack() {
        if (backDialogOpen) return;
        // En las páginas de la guía / Pokédex: volver a la página anterior (o al juego)
        Uri cur = web.getUrl() == null ? null : Uri.parse(web.getUrl());
        String p = cur == null ? null : cur.getPath();
        boolean inGame = p == null || p.equals("/") || p.equals("/index.html");
        if (!inGame) {
            if (web.canGoBack()) web.goBack(); else web.loadUrl(HOME);
            return;
        }
        web.evaluateJavascript("window.psBack?psBack():'exit'", v -> { if ("\"exit\"".equals(v)) askExit(); });
    }

    private void askExit() {
        if (backDialogOpen) return;
        backDialogOpen = true;
        new AlertDialog.Builder(this)
                .setTitle("¿Salir de PokéSurvivor?")
                .setMessage("Tu progreso queda guardado en el teléfono.")
                .setPositiveButton("Salir", (d, i) -> finish())
                .setNegativeButton("Seguir jugando", null)
                .setOnDismissListener(d -> { backDialogOpen = false; hideSystemBars(); })
                .show();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack(); // Android 12 y anteriores
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();   // el juego detecta que se ocultó, pausa y guarda
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
