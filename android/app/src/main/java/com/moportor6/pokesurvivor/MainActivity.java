package com.moportor6.pokesurvivor;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.WindowManager;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOST="appassets.androidplatform.net";
    private static final String HOME="https://"+HOST+"/assets/offline.html";
    private WebView web;
    @Override public void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive();
        web=new WebView(this);setContentView(web);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                if(!"https".equals(request.getUrl().getScheme())||!HOST.equals(request.getUrl().getHost()))return response(403,"Offline",new byte[0],"text/plain");
                String path=request.getUrl().getPath();
                if(path==null||!path.startsWith("/assets/")||path.contains("..")||!"GET".equals(request.getMethod()))return response(403,"Forbidden",new byte[0],"text/plain");
                String asset=path.substring(8);
                try{return new WebResourceResponse(mime(asset),"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-cache"),getAssets().open(asset));}
                catch(IOException e){return response(404,"Not Found",new byte[0],"text/plain");}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !HOST.equals(request.getUrl().getHost())||!"https".equals(request.getUrl().getScheme());}
        });
        if(savedInstanceState==null)web.loadUrl(HOME);else if(web.restoreState(savedInstanceState)==null)web.loadUrl(HOME);
    }
    private static WebResourceResponse response(int status,String reason,byte[] body,String type){return new WebResourceResponse(type,"UTF-8",status,reason,Collections.emptyMap(),new ByteArrayInputStream(body));}
    private static String mime(String path){
        String p=path.toLowerCase(Locale.ROOT);
        if(p.endsWith(".html"))return "text/html";if(p.endsWith(".js"))return "application/javascript";
        if(p.endsWith(".css"))return "text/css";if(p.endsWith(".png"))return "image/png";
        if(p.endsWith(".jpg")||p.endsWith(".jpeg"))return "image/jpeg";if(p.endsWith(".mp3"))return "audio/mpeg";
        if(p.endsWith(".json")||p.endsWith(".webmanifest"))return "application/json";if(p.endsWith(".ttf"))return "font/ttf";
        if(p.endsWith(".ico"))return "image/x-icon";if(p.endsWith(".svg"))return "image/svg+xml";return "application/octet-stream";
    }
    private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
    private void saveGame(){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('ps-offline-save'));",null);}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
    @Override protected void onPause(){saveGame();super.onPause();if(web!=null)web.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onSaveInstanceState(Bundle state){saveGame();web.saveState(state);super.onSaveInstanceState(state);}
    @Override public void onBackPressed(){saveGame();new AlertDialog.Builder(this).setTitle("Pokesurvivor Offline").setMessage("¿Volver a la portada local?").setNegativeButton("Seguir jugando",null).setPositiveButton("Portada",(d,w)->web.loadUrl(HOME)).show();}
    @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
