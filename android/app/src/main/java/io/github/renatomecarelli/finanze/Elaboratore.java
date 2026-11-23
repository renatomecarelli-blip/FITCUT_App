package io.github.renatomecarelli.finanze;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Fa leggere le notifiche arrivate alla stessa logica della pagina (comune.js).
 * Se l'app è aperta usa la sua pagina; se è chiusa apre una pagina invisibile, la usa e la chiude.
 * Se qualcosa va storto le notifiche restano in coda e si leggono alla prossima apertura dell'app.
 */
final class Elaboratore {
    private static final Handler h = new Handler(Looper.getMainLooper());
    private static boolean occupato;
    private static boolean ancora;

    private Elaboratore() {
    }

    static void avvia(Context c) {
        final Context app = c.getApplicationContext();
        h.post(() -> esegui(app));
    }

    private static void esegui(final Context c) {
        MainActivity m = MainActivity.attiva;
        if (m != null) {
            m.elabora();
            return;
        }
        if (occupato) {
            ancora = true;
            return;
        }
        if (Archivio.di(c).codaVuota()) return;
        occupato = true;
        final WebView[] w = new WebView[1];
        final boolean[] finito = {false};
        final Runnable fine = () -> {
            if (finito[0]) return;
            finito[0] = true;
            try {
                if (w[0] != null) w[0].destroy();
            } catch (Throwable t) {
                // già chiusa
            }
            occupato = false;
            if (ancora) {
                ancora = false;
                esegui(c);
            }
        };
        try {
            WebView v = new WebView(c);
            w[0] = v;
            v.getSettings().setJavaScriptEnabled(true);
            v.addJavascriptInterface(new Ponte(c, null), "Android");
            v.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    view.evaluateJavascript("(function(){try{return FIN.elaboraCoda();}catch(e){return '[]';}})()", r -> {
                        Avvisi.daRisultato(c, r);
                        fine.run();
                    });
                }
            });
            v.loadUrl("file:///android_asset/motore.html");
            h.postDelayed(fine, 20000);
        } catch (Throwable t) {
            fine.run();
        }
    }
}
