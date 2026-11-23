package io.github.renatomecarelli.finanze;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

/** Quello che la pagina può chiedere al telefono (window.Android). */
final class Ponte {
    private final Context c;
    private final MainActivity m;
    private final Archivio a;

    Ponte(Context c, MainActivity m) {
        this.c = c.getApplicationContext();
        this.m = m;
        this.a = Archivio.di(c);
    }

    @JavascriptInterface
    public String leggi(String k) {
        return a.leggi(k);
    }

    @JavascriptInterface
    public void scrivi(String k, String v) {
        a.scrivi(k, v);
    }

    @JavascriptInterface
    public String movimenti() {
        return a.movimenti();
    }

    @JavascriptInterface
    public void movSalva(String id, String corpo) {
        a.movSalva(id, corpo);
    }

    @JavascriptInterface
    public void movCancella(String id) {
        a.movCancella(id);
    }

    @JavascriptInterface
    public String codaLeggi() {
        return a.codaLeggi();
    }

    @JavascriptInterface
    public void codaTogli(int n) {
        a.codaTogli(n);
    }

    @JavascriptInterface
    public String registro() {
        return a.registro();
    }

    @JavascriptInterface
    public void registra(String voce) {
        a.registra(voce);
    }

    /** la lettura delle notifiche è accesa nelle impostazioni di Android? */
    @JavascriptInterface
    public boolean letturaAttiva() {
        String s = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        ComponentName cn = new ComponentName(c, Ascolto.class);
        return s != null && (s.contains(cn.flattenToString()) || s.contains(cn.flattenToShortString()));
    }

    /** l'app può mostrare le sue notifiche? */
    @JavascriptInterface
    public boolean notificheAttive() {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    @JavascriptInterface
    public String versione() {
        try {
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return p.versionName;
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public boolean puoiDettare() {
        return m != null && m.puoiDettare();
    }

    @JavascriptInterface
    public void detta() {
        if (m != null) m.runOnUiThread(m::detta);
    }

    @JavascriptInterface
    public void salvaFile(final String nome, final String testo) {
        if (m != null) m.runOnUiThread(() -> m.salvaFile(nome, testo));
    }

    @JavascriptInterface
    public void scegliFile() {
        if (m != null) m.runOnUiThread(m::scegliFile);
    }

    @JavascriptInterface
    public String appunti() {
        return m == null ? "" : m.appunti();
    }

    @JavascriptInterface
    public void apriLettura() {
        if (m != null) m.runOnUiThread(m::apriLettura);
    }

    @JavascriptInterface
    public void apriInfoApp() {
        if (m != null) m.runOnUiThread(m::apriInfoApp);
    }

    @JavascriptInterface
    public void chiediNotifiche() {
        if (m != null) m.runOnUiThread(m::chiediNotifiche);
    }
}
