package io.github.renatomecarelli.finanze;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

/** L'app: una pagina (assets/index.html) con i conti, più quello che serve dal telefono. */
public class MainActivity extends Activity {
    static MainActivity attiva;
    private static final int R_FILE = 11, R_SALVA = 12, R_VOCE = 13, R_PERMESSO = 14, R_APRI = 15;
    private static final String NOTIFICHE = "android.permission.POST_NOTIFICATIONS";

    private WebView web;
    private ValueCallback<Uri[]> scelta;
    private String daSalvare;
    private boolean paginaPronta;
    private String fileInAttesa;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Avvisi.canali(this);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        web.addJavascriptInterface(new Ponte(this, this), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                paginaPronta = true;
                if (fileInAttesa != null) {
                    String f = fileInAttesa;
                    fileInAttesa = null;
                    evento(f);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    // nessuna app per aprirlo
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (scelta != null) scelta.onReceiveValue(null);
                scelta = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try {
                    startActivityForResult(i, R_FILE);
                } catch (Exception e) {
                    scelta = null;
                    return false;
                }
                return true;
            }
        });
        web.loadUrl("file:///android_asset/index.html");
        primaVoltaNotifiche();
        apriDaFuori(getIntent());
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        apriDaFuori(i);
    }

    /** il backup aperto con "Apri con Finanze" o "Condividi → Finanze" */
    private void apriDaFuori(Intent i) {
        if (i == null) return;
        String a = i.getAction();
        Uri u = null;
        if (Intent.ACTION_VIEW.equals(a)) u = i.getData();
        else if (Intent.ACTION_SEND.equals(a)) {
            u = i.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u == null) {
                CharSequence t = i.getCharSequenceExtra(Intent.EXTRA_TEXT);
                if (t != null) consegna(t.toString());
                return;
            }
        } else return;
        if (u != null) consegna(leggiTesto(u));
        i.setAction(Intent.ACTION_MAIN);   // se l'app si riapre non lo rifà
    }

    private void consegna(String testo) {
        String e = testo == null ? "{\"tipo\":\"file\",\"errore\":true}" : "{\"tipo\":\"file\",\"testo\":" + JSONObject.quote(testo) + "}";
        if (paginaPronta) evento(e);
        else fileInAttesa = e;
    }

    private String leggiTesto(Uri u) {
        try (InputStream in = getContentResolver().openInputStream(u)) {
            if (in == null) return null;
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n, tot = 0;
            while ((n = in.read(buf)) > 0) {
                b.write(buf, 0, n);
                tot += n;
                if (tot > 5000000) return null;
            }
            return b.toString("UTF-8");
        } catch (Exception e) {
            return null;
        }
    }

    // 📂 scegli il file del backup
    void scegliFile() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
        try {
            startActivityForResult(i, R_APRI);
        } catch (Exception e) {
            evento("{\"tipo\":\"file\",\"errore\":true}");
        }
    }

    /** il testo copiato negli appunti (per "Incolla il backup") */
    String appunti() {
        try {
            ClipboardManager cm = getSystemService(ClipboardManager.class);
            if (cm == null || !cm.hasPrimaryClip()) return "";
            ClipData c = cm.getPrimaryClip();
            if (c == null || c.getItemCount() == 0) return "";
            CharSequence t = c.getItemAt(0).coerceToText(this);
            return t == null ? "" : t.toString();
        } catch (Exception e) {
            return "";
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        attiva = this;
        evento("{\"tipo\":\"ripresa\"}");
    }

    @Override
    protected void onPause() {
        if (attiva == this) attiva = null;
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (attiva == this) attiva = null;
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** sono arrivate notifiche mentre l'app è aperta */
    void elabora() {
        if (web != null) web.evaluateJavascript("window.__ponte&&__ponte.elabora()", null);
    }

    private void evento(String json) {
        if (web != null) web.evaluateJavascript("window.__ponte&&__ponte.evento(" + json + ")", null);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) {
            moveTaskToBack(true);
            return;
        }
        web.evaluateJavascript("(window.__ponte?__ponte.indietro():false)", v -> {
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    // 🎙 voce
    boolean puoiDettare() {
        return new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).resolveActivity(getPackageManager()) != null;
    }

    void detta() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "it-IT");
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Di' quanto e dove, es. «3 euro e 50 al bar»");
        try {
            startActivityForResult(i, R_VOCE);
        } catch (Exception e) {
            evento("{\"tipo\":\"dettato\",\"testo\":\"\"}");
        }
    }

    // 💾 backup in un file
    void salvaFile(String nome, String testo) {
        daSalvare = testo;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, nome);
        try {
            startActivityForResult(i, R_SALVA);
        } catch (Exception e) {
            daSalvare = null;
            evento("{\"tipo\":\"salvato\",\"ok\":false}");
        }
    }

    // ⚙️ impostazioni di Android
    void apriLettura() {
        ComponentName cn = new ComponentName(this, Ascolto.class);
        Intent i;
        if (Build.VERSION.SDK_INT >= 30) {
            i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, cn.flattenToString());
        } else {
            i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        }
        try {
            startActivity(i);
        } catch (Exception e) {
            try {
                startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            } catch (Exception e2) {
                apriInfoApp();
            }
        }
    }

    void apriInfoApp() {
        try {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null)));
        } catch (Exception e) {
            // impossibile aprirle
        }
    }

    void chiediNotifiche() {
        SharedPreferences p = getSharedPreferences("app", MODE_PRIVATE);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(NOTIFICHE) != PackageManager.PERMISSION_GRANTED && !p.getBoolean("chiesto2", false)) {
            p.edit().putBoolean("chiesto2", true).apply();
            requestPermissions(new String[]{NOTIFICHE}, R_PERMESSO);
            return;
        }
        try {
            startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
        } catch (Exception e) {
            apriInfoApp();
        }
    }

    private void primaVoltaNotifiche() {
        SharedPreferences p = getSharedPreferences("app", MODE_PRIVATE);
        if (Build.VERSION.SDK_INT >= 33 && !p.getBoolean("chiesto", false) && checkSelfPermission(NOTIFICHE) != PackageManager.PERMISSION_GRANTED) {
            p.edit().putBoolean("chiesto", true).apply();
            requestPermissions(new String[]{NOTIFICHE}, R_PERMESSO);
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] permessi, int[] esiti) {
        super.onRequestPermissionsResult(req, permessi, esiti);
        evento("{\"tipo\":\"ripresa\"}");
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == R_FILE) {
            if (scelta != null) {
                Uri u = res == RESULT_OK && data != null ? data.getData() : null;
                scelta.onReceiveValue(u == null ? null : new Uri[]{u});
                scelta = null;
            }
        } else if (req == R_APRI) {
            Uri u = res == RESULT_OK && data != null ? data.getData() : null;
            if (u != null) consegna(leggiTesto(u));
        } else if (req == R_SALVA) {
            boolean ok = false;
            Uri u = res == RESULT_OK && data != null ? data.getData() : null;
            if (u != null && daSalvare != null) {
                try (OutputStream o = getContentResolver().openOutputStream(u)) {
                    if (o != null) {
                        o.write(daSalvare.getBytes(StandardCharsets.UTF_8));
                        ok = true;
                    }
                } catch (Exception e) {
                    ok = false;
                }
            }
            daSalvare = null;
            evento("{\"tipo\":\"salvato\",\"ok\":" + ok + "}");
        } else if (req == R_VOCE) {
            String t = "";
            if (res == RESULT_OK && data != null) {
                ArrayList<String> l = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (l != null && !l.isEmpty() && l.get(0) != null) t = l.get(0);
            }
            evento("{\"tipo\":\"dettato\",\"testo\":" + JSONObject.quote(t) + "}");
        }
    }
}
