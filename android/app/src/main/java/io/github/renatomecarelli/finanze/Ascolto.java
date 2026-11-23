package io.github.renatomecarelli.finanze;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

import java.util.Locale;

/** Legge le notifiche di Google Pay (Wallet), Gmail (mail di MPS e PayPal) e PayPal. Le altre non le guarda neanche. */
public class Ascolto extends NotificationListenerService {
    static final String WALLET = "com.google.android.apps.walletnfcrel";
    static final String GMS = "com.google.android.gms";
    static final String GMAIL = "com.google.android.gm";
    static final String PAYPAL = "com.paypal.android.p2pmobile";
    static final String MPS = "it.copergmps.rt.pf.android.sp.bmps";

    @Override
    public void onListenerConnected() {
        Elaboratore.avvia(this);
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            gestisci(sbn);
        } catch (Throwable t) {
            // una notifica strana non deve mai fermare l'ascolto
        }
    }

    private void gestisci(StatusBarNotification sbn) throws Exception {
        if (sbn == null) return;
        String app = sbn.getPackageName();
        if (!(WALLET.equals(app) || GMS.equals(app) || GMAIL.equals(app) || PAYPAL.equals(app) || MPS.equals(app))) return;
        Notification n = sbn.getNotification();
        if (n == null || n.extras == null) return;
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle x = n.extras;
        String titolo = t(x.getCharSequence(Notification.EXTRA_TITLE));
        String testo = t(x.getCharSequence(Notification.EXTRA_TEXT));
        String grande = t(x.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String sotto = t(x.getCharSequence(Notification.EXTRA_SUB_TEXT));
        StringBuilder righe = new StringBuilder();
        CharSequence[] rr = x.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (rr != null) for (CharSequence r : rr) {
            if (righe.length() > 0) righe.append('\n');
            righe.append(t(r));
        }
        if (titolo.isEmpty() && testo.isEmpty() && grande.isEmpty()) return;
        String tutto = (titolo + " " + testo + " " + grande + " " + righe).toLowerCase(Locale.ROOT);
        // di Gmail mi interessano solo le mail della banca e di PayPal
        if (GMAIL.equals(app) && !(tutto.contains("paschi") || tutto.contains("mps") || tutto.contains("paypal"))) return;
        // da Google Play Services solo le notifiche con un importo
        if (GMS.equals(app) && !(tutto.contains("€") || tutto.contains("eur"))) return;
        long quando = sbn.getPostTime();
        String impronta = app + "|" + (n.when != 0 ? n.when : quando / 60000) + "|" + titolo + "|" + testo + "|" + grande;
        Archivio a = Archivio.di(this);
        if (a.giaVista(impronta)) return;
        JSONObject o = new JSONObject();
        o.put("app", app);
        o.put("titolo", titolo);
        o.put("testo", testo);
        o.put("grande", grande);
        o.put("sotto", sotto);
        o.put("righe", righe.toString());
        o.put("quando", quando);
        a.accoda(o);
        Elaboratore.avvia(this);
    }

    private static String t(CharSequence c) {
        return c == null ? "" : c.toString().trim();
    }
}
