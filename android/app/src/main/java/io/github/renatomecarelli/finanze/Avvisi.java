package io.github.renatomecarelli.finanze;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/** Le notifiche dell'app: "−10,00 € · Revolut — Oggi puoi spendere ancora…" */
final class Avvisi {
    static final String SPESE = "spese";
    static final String INFO = "info";

    private Avvisi() {
    }

    static void canali(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel a = new NotificationChannel(SPESE, "Spese segnate", NotificationManager.IMPORTANCE_DEFAULT);
        a.setDescription("Quando l'app segna una spesa o trova qualcosa da controllare");
        NotificationChannel b = new NotificationChannel(INFO, "Saldo e altre informazioni", NotificationManager.IMPORTANCE_LOW);
        b.setDescription("Saldo del conto letto dalle mail di MPS");
        nm.createNotificationChannel(a);
        nm.createNotificationChannel(b);
    }

    static void mostra(Context c, String titolo, String testo, String canale) {
        try {
            canali(c);
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm == null) return;
            boolean info = INFO.equals(canale);
            Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification.Builder b = new Notification.Builder(c, info ? INFO : SPESE)
                    .setSmallIcon(R.drawable.ic_notifica)
                    .setColor(0xFF1E6B55)
                    .setContentTitle(titolo)
                    .setContentText(testo)
                    .setStyle(new Notification.BigTextStyle().bigText(testo))
                    .setContentIntent(pi)
                    .setAutoCancel(true)
                    .setShowWhen(true);
            // il saldo sostituisce quello di ieri; le spese restano una per una
            int id = info ? 1 : (int) (System.currentTimeMillis() % 1000000) + 10;
            nm.notify(id, b.build());
        } catch (Throwable t) {
            // senza permesso per le notifiche non si vede niente, ma la spesa è comunque segnata
        }
    }

    /** r è quello che restituisce FIN.elaboraCoda(): una lista di avvisi in JSON */
    static void daRisultato(Context c, String r) {
        try {
            if (r == null) return;
            Object v = new JSONTokener(r).nextValue();
            JSONArray a = v instanceof String ? new JSONArray((String) v) : (v instanceof JSONArray ? (JSONArray) v : null);
            if (a == null) return;
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                mostra(c, o.optString("titolo"), o.optString("testo"), o.optString("canale"));
            }
        } catch (Throwable t) {
            // risultato strano: niente avviso
        }
    }
}
