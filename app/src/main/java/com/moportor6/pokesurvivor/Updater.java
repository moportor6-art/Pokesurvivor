package com.moportor6.pokesurvivor;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Actualizador del juego.
 * <p>
 * Cada compilación de GitHub se publica como versión (build-N) con su APK y un manifiesto (contenido.json) que lista
 * cada archivo del juego con su SHA-256. La APK trae su propio manifiesto (assets/contenido-base.json).
 * <ul>
 * <li>Si solo cambió el juego (la parte web), se bajan <b>solo los archivos que cambiaron</b> a files/contenido/build-N,
 * se comprueba cada uno y la app los sirve en lugar de los de la APK. No se reinstala nada.</li>
 * <li>Si cambió la parte nativa (Java, manifiesto, recursos), se baja la APK completa y la instala el instalador de
 * Android encima de la actual (misma firma: no hace falta desinstalar).</li>
 * <li>Antes de nada se ven las novedades y el tamaño; se puede actualizar, dejarlo para luego u omitir esa versión.</li>
 * <li>Vuelta atrás: si el juego no arranca con lo nuevo, en el siguiente inicio se vuelve solo a lo anterior. Y desde el
 * juego (Actualizaciones) se puede volver a lo que trae la APK.</li>
 * </ul>
 * Las partidas guardadas no se tocan nunca (viven en el almacenamiento del WebView).
 */
final class Updater {
    private static final String REPO = "moportor6-art/Pokesurvivor";
    private static final String LATEST = "https://api.github.com/repos/" + REPO + "/releases/latest";
    private static final String RELEASES = "https://api.github.com/repos/" + REPO + "/releases?per_page=15";
    private static final String RAW = "https://raw.githubusercontent.com/" + REPO + "/%s/app/src/main/assets/www/%s";

    private final Activity act;
    private final WebView web;
    private final SharedPreferences prefs;
    private final File root;
    private JSONObject base;                        // cabecera del manifiesto de la APK: build y huella nativa (null en compilaciones locales)
    private JSONObject baseFiles;                   // lista de archivos de la APK: se lee solo al actualizar (es grande)
    private volatile Map<String, String> overlay = new HashMap<>();   // archivo → sha de la capa activa
    private volatile Set<String> removed = new HashSet<>();           // archivos que la versión nueva ya no tiene
    private volatile File overlayDir;
    private volatile int overlayBuild;
    private volatile boolean busy;
    private String rolledBack;                      // aviso para mostrar al arrancar

    Updater(Activity a, WebView w) {
        act = a;
        web = w;
        prefs = a.getSharedPreferences("actualizador", Activity.MODE_PRIVATE);
        root = new File(a.getFilesDir(), "contenido");
        // El manifiesto tiene decenas de miles de archivos: al abrir solo se lee la cabecera (build, commit, nativo),
        // que manifiesto.py escribe al principio. La lista completa se lee en segundo plano al buscar actualizaciones.
        try (InputStream in = a.getAssets().open("contenido-base.json")) {
            byte[] head = new byte[512];
            int n = 0;
            for (int r; n < head.length && (r = in.read(head, n, head.length - n)) > 0; ) n += r;
            String h = new String(head, 0, n, "UTF-8");
            int cut = h.indexOf(",\"files\"");
            base = cut > 0 ? new JSONObject(h.substring(0, cut) + "}") : null;
        } catch (Exception e) {
            base = null;
        }
        // Vuelta atrás automática: la versión nueva se activó pero el juego nunca avisó que arrancó
        if (prefs.getBoolean("bootPending", false) && prefs.getString("active", null) != null) {
            String bad = prefs.getString("active", null);
            prefs.edit().putString("active", prefs.getString("prev", null)).remove("prev").putBoolean("bootPending", false)
                    .putInt("skip", buildOf(bad)).apply();
            rolledBack = "La actualización " + bad + " no arrancó bien: se volvió a la versión anterior.";
        }
        loadActive();
    }

    // ─── Lo que usa el servidor de archivos de la app ───

    /** Archivo de la actualización que reemplaza al de la APK, o null. path: relativo al juego, sin "/" inicial. */
    File overlayFile(String path) {
        File d = overlayDir;
        if (d == null || !overlay.containsKey(path)) return null;
        File f = new File(d, path);
        return f.isFile() ? f : null;
    }

    /** La versión activa ya no tiene este archivo. */
    boolean isRemoved(String path) {
        return overlayDir != null && removed.contains(path);
    }

    private void loadActive() {
        overlay = new HashMap<>();
        removed = new HashSet<>();
        overlayDir = null;
        overlayBuild = 0;
        String name = prefs.getString("active", null);
        if (name == null || base == null) return;
        File dir = new File(root, name);
        try (InputStream in = new FileInputStream(new File(dir, "manifest.json"))) {
            JSONObject m = new JSONObject(readAll(in));
            int b = m.getInt("build");
            if (b <= base.getInt("build")) {   // la APK instalada ya es igual o más nueva: la capa sobra
                prefs.edit().remove("active").remove("prev").apply();
                cleanup(null, null);
                return;
            }
            Map<String, String> o = new HashMap<>();
            JSONObject fs = m.getJSONObject("files");
            for (Iterator<String> it = fs.keys(); it.hasNext(); ) { String k = it.next(); o.put(k, fs.getString(k)); }
            Set<String> r = new HashSet<>();
            JSONArray rm = m.optJSONArray("removed");
            if (rm != null) for (int i = 0; i < rm.length(); i++) r.add(rm.getString(i));
            overlay = o;
            removed = r;
            overlayBuild = b;
            overlayDir = dir;
        } catch (Exception e) {
            prefs.edit().remove("active").apply();
        }
    }

    // ─── Lo que llama el juego (puente PSNative, www/local.js) ───

    /** El juego arrancó bien con la versión activa. */
    void booted() {
        if (prefs.getBoolean("bootPending", false)) prefs.edit().putBoolean("bootPending", false).apply();
        if (rolledBack != null) {
            final String msg = rolledBack;
            rolledBack = null;
            act.runOnUiThread(() -> Toast.makeText(act, msg, Toast.LENGTH_LONG).show());
        }
    }

    String info() {
        try {
            JSONObject o = new JSONObject();
            o.put("app", appBuild());
            o.put("name", appName());
            o.put("base", base == null ? 0 : base.getInt("build"));
            o.put("active", overlayBuild);
            o.put("enabled", base != null);
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    /** Vuelve a lo que trae la APK (borra las actualizaciones de archivos). */
    void reset() {
        prefs.edit().remove("active").remove("prev").putBoolean("bootPending", false).apply();
        loadActive();
        cleanup(null, null);
        act.runOnUiThread(() -> { Toast.makeText(act, "Se volvió a la versión de la app.", Toast.LENGTH_LONG).show(); web.reload(); });
    }

    /** Historial de versiones para la ventana del juego: llama a fusionUpdHistory(json). */
    void history() {
        new Thread(() -> {
            String out;
            try {
                JSONArray rel = new JSONArray(get(RELEASES)), list = new JSONArray();
                for (int i = 0; i < rel.length(); i++) {
                    JSONObject r = rel.getJSONObject(i), o = new JSONObject();
                    o.put("build", buildOf(r.optString("tag_name")));
                    o.put("date", r.optString("published_at"));
                    o.put("notes", r.optString("body"));
                    list.put(o);
                }
                out = list.toString();
            } catch (Exception e) {
                out = "null";
            }
            final String js = "window.fusionUpdHistory&&fusionUpdHistory(" + out + ")";
            act.runOnUiThread(() -> web.evaluateJavascript(js, null));
        }).start();
    }

    /** Busca una versión nueva. manual: avisa también si no hay nada o si falla. */
    void check(final boolean manual) {
        if (base == null) { if (manual) toast("Esta compilación no tiene actualizador (es de prueba)."); return; }
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                JSONObject rel = new JSONObject(get(LATEST));
                int remote = buildOf(rel.optString("tag_name"));
                int current = Math.max(base.getInt("build"), overlayBuild);
                if (remote <= current) {
                    if (manual) toast("Ya tienes la última versión (build " + current + ").");
                    return;
                }
                if (!manual && prefs.getInt("skip", 0) == remote) return;
                String manUrl = null, apkUrl = null;
                JSONArray assets = rel.getJSONArray("assets");
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject a = assets.getJSONObject(i);
                    String n = a.optString("name");
                    if (n.equals("contenido.json")) manUrl = a.optString("browser_download_url");
                    else if (n.endsWith(".apk")) apkUrl = a.optString("browser_download_url");
                }
                if (manUrl == null) throw new Exception("la versión no trae su manifiesto");
                JSONObject man = new JSONObject(get(manUrl));
                String notes = rel.optString("body").trim();
                if (!man.optString("native").equals(base.optString("native"))) {
                    if (apkUrl == null) throw new Exception("la versión no trae la APK");
                    JSONObject apk = man.optJSONObject("apk");
                    long size = apk == null ? 0 : apk.optLong("size");
                    final String url = apkUrl, sha = apk == null ? null : apk.optString("sha", null);
                    ui(() -> offer(remote, notes, "Esta versión cambia la app: se descarga completa (" + mb(size)
                            + ") y Android te pide confirmar la instalación. Tus partidas se conservan.", () -> installApk(url, sha, size)));
                } else {
                    final Plan plan = plan(man);
                    if (plan.download.isEmpty() && plan.reuse.isEmpty() && plan.removed.isEmpty()) {
                        if (manual) toast("Ya tienes la última versión.");
                        return;
                    }
                    ui(() -> offer(remote, notes, "Se descargan solo " + plan.download.size() + " archivo"
                            + (plan.download.size() == 1 ? "" : "s") + " (" + mb(plan.bytes) + "). No hace falta reinstalar.", () -> applyContent(plan)));
                }
            } catch (Exception e) {
                if (manual) toast("No se pudo buscar actualizaciones (¿sin internet?).");
            } finally {
                busy = false;
            }
        }).start();
    }

    private void offer(int build, String notes, String what, Runnable go) {
        if (act.isFinishing()) return;
        StringBuilder msg = new StringBuilder();
        if (!notes.isEmpty()) msg.append("Novedades:\n").append(notes.length() > 1500 ? notes.substring(0, 1500) + "…" : notes).append("\n\n");
        msg.append(what);
        new AlertDialog.Builder(act)
                .setTitle("Nueva versión: build " + build)
                .setMessage(msg.toString())
                .setPositiveButton("Actualizar", (d, i) -> go.run())
                .setNeutralButton("Omitir esta versión", (d, i) -> prefs.edit().putInt("skip", build).apply())
                .setNegativeButton("Más tarde", null)
                .show();
    }

    // ─── Actualización de archivos ───

    private static final class Plan {
        int build;
        String commit;
        long bytes;
        final Map<String, String> files = new HashMap<>();      // archivos de la capa nueva (los que difieren de la APK)
        final List<String> download = new ArrayList<>();        // los que hay que bajar
        final List<String> reuse = new ArrayList<>();           // los que ya están en la capa actual
        final List<String> removed = new ArrayList<>();         // los de la APK que la versión nueva ya no tiene
    }

    private Plan plan(JSONObject man) throws Exception {
        Plan p = new Plan();
        p.build = man.getInt("build");
        p.commit = man.getString("commit");
        if (baseFiles == null) {
            try (InputStream in = act.getAssets().open("contenido-base.json")) {
                baseFiles = new JSONObject(readAll(in)).getJSONObject("files");
            }
        }
        JSONObject fs = man.getJSONObject("files"), bfs = baseFiles;
        for (Iterator<String> it = fs.keys(); it.hasNext(); ) {
            String path = it.next();
            JSONObject f = fs.getJSONObject(path);
            String sha = f.getString("s");
            JSONObject b = bfs.optJSONObject(path);
            if (b != null && sha.equals(b.optString("s"))) continue;   // igual al de la APK: no hace falta capa
            p.files.put(path, sha);
            if (sha.equals(overlay.get(path)) && overlayFile(path) != null) p.reuse.add(path);
            else { p.download.add(path); p.bytes += f.optLong("n"); }
        }
        for (Iterator<String> it = bfs.keys(); it.hasNext(); ) { String path = it.next(); if (!fs.has(path)) p.removed.add(path); }
        return p;
    }

    private void applyContent(final Plan p) {
        final Progress pr = new Progress("Actualizando a build " + p.build, p.download.size());
        new Thread(() -> {
            String name = "build-" + p.build;
            File tmp = new File(root, name + ".tmp"), dir = new File(root, name);
            try {
                deleteTree(tmp);
                int done = 0;
                for (String path : p.reuse) copy(new File(overlayDir, path), new File(tmp, path));
                for (String path : p.download) {
                    File f = new File(tmp, path);
                    download(String.format(Locale.ROOT, RAW, p.commit, encodePath(path)), f, null);
                    if (!p.files.get(path).equals(sha256(f))) throw new Exception("el archivo " + path + " llegó dañado");
                    pr.set(++done, path);
                }
                JSONObject m = new JSONObject(), fs = new JSONObject();
                for (Map.Entry<String, String> e : p.files.entrySet()) fs.put(e.getKey(), e.getValue());
                m.put("build", p.build);
                m.put("files", fs);
                m.put("removed", new JSONArray(p.removed));
                try (OutputStream o = new FileOutputStream(new File(tmp, "manifest.json"))) { o.write(m.toString().getBytes("UTF-8")); }
                deleteTree(dir);
                if (!tmp.renameTo(dir)) throw new Exception("no se pudo guardar");
                String prev = prefs.getString("active", null);
                prefs.edit().putString("prev", prev).putString("active", name).putBoolean("bootPending", true).apply();
                loadActive();
                cleanup(name, prev);
                ui(() -> { pr.close(); Toast.makeText(act, "Actualizado a build " + p.build, Toast.LENGTH_LONG).show(); web.reload(); });
            } catch (Exception e) {
                deleteTree(tmp);
                final String m = e.getMessage();
                ui(() -> { pr.close(); dialog("No se pudo actualizar", "No se cambió nada. " + (m == null ? "" : "(" + m + ")")); });
            }
        }).start();
    }

    // ─── Actualización completa (APK) ───

    private void installApk(final String url, final String sha, final long size) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !act.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(act)
                    .setTitle("Permiso para actualizar")
                    .setMessage("Para instalar la actualización, Android pide permitir que PokéSurvivor instale apps. "
                            + "Actívalo en la pantalla que se abre, vuelve y pulsa Actualizar otra vez.")
                    .setPositiveButton("Abrir ajustes", (d, i) -> act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + act.getPackageName()))))
                    .setNegativeButton("Cancelar", null)
                    .show();
            return;
        }
        final Progress pr = new Progress("Descargando la app", 100);
        new Thread(() -> {
            File f = new File(act.getCacheDir(), "actualizacion.apk");
            try {
                download(url, f, (got) -> pr.set(size > 0 ? (int) (got * 100 / size) : 0, mb(got)));
                if (sha != null && !sha.isEmpty() && !sha.equals(sha256(f))) throw new Exception("la descarga llegó dañada");
                PackageInstaller pi = act.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                sp.setAppPackageName(act.getPackageName());
                int id = pi.createSession(sp);
                try (PackageInstaller.Session s = pi.openSession(id)) {
                    try (InputStream in = new FileInputStream(f); OutputStream out = s.openWrite("app.apk", 0, f.length())) {
                        byte[] b = new byte[1 << 16];
                        for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
                        s.fsync(out);
                    }
                    Intent cb = new Intent(act, InstallReceiver.class);
                    int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    s.commit(PendingIntent.getBroadcast(act, id, cb, fl).getIntentSender());
                }
                ui(pr::close);
            } catch (Exception e) {
                final String m = e.getMessage();
                ui(() -> { pr.close(); dialog("No se pudo actualizar", "No se cambió nada. " + (m == null ? "" : "(" + m + ")")); });
            }
        }).start();
    }

    // ─── Ayudantes ───

    private interface OnBytes { void got(long n); }

    private final class Progress {
        private final AlertDialog dlg;
        private final ProgressBar bar;
        private final TextView label;

        Progress(String title, int max) {
            LinearLayout box = new LinearLayout(act);
            box.setOrientation(LinearLayout.VERTICAL);
            int pad = (int) (20 * act.getResources().getDisplayMetrics().density);
            box.setPadding(pad, pad / 2, pad, 0);
            bar = new ProgressBar(act, null, android.R.attr.progressBarStyleHorizontal);
            bar.setMax(Math.max(1, max));
            label = new TextView(act);
            box.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            box.addView(label);
            dlg = new AlertDialog.Builder(act).setTitle(title).setView(box).setCancelable(false).create();
            dlg.show();
        }

        void set(int v, String text) { ui(() -> { bar.setProgress(v); label.setText(text); }); }

        void close() { if (dlg.isShowing()) dlg.dismiss(); }
    }

    private void ui(Runnable r) { act.runOnUiThread(r); }

    private void toast(String m) { ui(() -> Toast.makeText(act, m, Toast.LENGTH_LONG).show()); }

    private void dialog(String title, String msg) {
        if (!act.isFinishing()) new AlertDialog.Builder(act).setTitle(title).setMessage(msg).setPositiveButton("Aceptar", null).show();
    }

    private int appBuild() {
        try {
            PackageInfo pi = act.getPackageManager().getPackageInfo(act.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? (int) pi.getLongVersionCode() : pi.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    private String appName() {
        try {
            return act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private static int buildOf(String tag) {
        if (tag == null) return 0;
        try { return Integer.parseInt(tag.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; }
    }

    private static String mb(long b) {
        return b < 1024 * 1024 ? String.format(Locale.ROOT, "%d KB", Math.max(1, b / 1024)) : String.format(Locale.ROOT, "%.1f MB", b / 1048576.0);
    }

    private static String encodePath(String p) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (String part : p.split("/")) {
            if (sb.length() > 0) sb.append('/');
            sb.append(java.net.URLEncoder.encode(part, "UTF-8").replace("+", "%20"));
        }
        return sb.toString();
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "PokeSurvivor-Updater");
        c.setRequestProperty("Accept", url.contains("api.github.com") ? "application/vnd.github+json" : "*/*");
        c.setInstanceFollowRedirects(true);
        int code = c.getResponseCode();
        if (code >= 300 && code < 400) {   // redirección a otro dominio (las descargas de GitHub)
            String loc = c.getHeaderField("Location");
            c.disconnect();
            return open(loc);
        }
        if (code != 200) throw new Exception("HTTP " + code);
        return c;
    }

    private static String get(String url) throws Exception {
        HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream()) { return readAll(in); } finally { c.disconnect(); }
    }

    private static void download(String url, File to, OnBytes progress) throws Exception {
        File parent = to.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) throw new Exception("sin espacio");
        HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(to)) {
            byte[] b = new byte[1 << 16];
            long got = 0, last = 0;
            for (int n; (n = in.read(b)) > 0; ) {
                out.write(b, 0, n);
                got += n;
                if (progress != null && got - last > 256 * 1024) { last = got; progress.got(got); }
            }
            if (progress != null) progress.got(got);
        } finally {
            c.disconnect();
        }
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[1 << 14];
        for (int n; (n = in.read(b)) > 0; ) o.write(b, 0, n);
        return o.toString("UTF-8");
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] b = new byte[1 << 16];
            for (int n; (n = in.read(b)) > 0; ) md.update(b, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte x : md.digest()) sb.append(String.format(Locale.ROOT, "%02x", x));
        return sb.toString();
    }

    private static void copy(File from, File to) throws Exception {
        File parent = to.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) throw new Exception("sin espacio");
        try (InputStream in = new FileInputStream(from); OutputStream out = new FileOutputStream(to)) {
            byte[] b = new byte[1 << 16];
            for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
        }
    }

    /** Borra las capas viejas: se quedan la activa y la anterior (para volver atrás). */
    private void cleanup(String keep1, String keep2) {
        File[] all = root.listFiles();
        if (all == null) return;
        for (File d : all) {
            String n = d.getName();
            if (n.equals(keep1) || n.equals(keep2)) continue;
            deleteTree(d);
        }
    }

    private static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
