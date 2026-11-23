package io.github.renatomecarelli.finanze;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** I dati dell'app, salvati solo sul telefono. Un solo punto d'accesso, così due scritture non si pestano i piedi. */
final class Archivio {
    private static Archivio io;
    private final SharedPreferences sp;

    private Archivio(Context c) {
        sp = c.getApplicationContext().getSharedPreferences("finanze", Context.MODE_PRIVATE);
    }

    static synchronized Archivio di(Context c) {
        if (io == null) io = new Archivio(c);
        return io;
    }

    synchronized String leggi(String k) {
        return sp.getString(k, null);
    }

    synchronized void scrivi(String k, String v) {
        if (v == null || v.isEmpty()) sp.edit().remove(k).commit();
        else sp.edit().putString(k, v).commit();
    }

    // 🧾 movimenti: un oggetto JSON { id: movimento }
    synchronized String movimenti() {
        return sp.getString("movimenti", "{}");
    }

    synchronized void movSalva(String id, String corpo) {
        try {
            JSONObject o = new JSONObject(movimenti());
            o.put(id, new JSONObject(corpo));
            sp.edit().putString("movimenti", o.toString()).commit();
        } catch (Exception e) {
            // movimento non valido: lo salto
        }
    }

    synchronized void movCancella(String id) {
        try {
            JSONObject o = new JSONObject(movimenti());
            o.remove(id);
            sp.edit().putString("movimenti", o.toString()).commit();
        } catch (Exception e) {
            // niente da fare
        }
    }

    // 📥 notifiche arrivate e non ancora lette dalla pagina
    synchronized void accoda(JSONObject n) {
        try {
            JSONArray a = new JSONArray(sp.getString("coda", "[]"));
            a.put(n);
            while (a.length() > 200) a.remove(0);
            sp.edit().putString("coda", a.toString()).commit();
        } catch (Exception e) {
            // coda rovinata: riparto
            sp.edit().remove("coda").commit();
        }
    }

    synchronized String codaLeggi() {
        return sp.getString("coda", "[]");
    }

    synchronized void codaTogli(int n) {
        try {
            JSONArray a = new JSONArray(sp.getString("coda", "[]"));
            for (int i = 0; i < n && a.length() > 0; i++) a.remove(0);
            sp.edit().putString("coda", a.toString()).commit();
        } catch (Exception e) {
            sp.edit().remove("coda").commit();
        }
    }

    synchronized boolean codaVuota() {
        try {
            return new JSONArray(sp.getString("coda", "[]")).length() == 0;
        } catch (Exception e) {
            return true;
        }
    }

    // 📋 registro delle ultime notifiche lette (per controllare che tutto funzioni)
    synchronized String registro() {
        return sp.getString("registro", "[]");
    }

    synchronized void registra(String voce) {
        try {
            JSONArray a = new JSONArray(sp.getString("registro", "[]"));
            a.put(new JSONObject(voce));
            while (a.length() > 40) a.remove(0);
            sp.edit().putString("registro", a.toString()).commit();
        } catch (Exception e) {
            sp.edit().remove("registro").commit();
        }
    }

    /** true se questa notifica l'abbiamo già vista: le app a volte la ripubblicano uguale */
    synchronized boolean giaVista(String impronta) {
        try {
            JSONArray a = new JSONArray(sp.getString("visti", "[]"));
            for (int i = 0; i < a.length(); i++) if (impronta.equals(a.optString(i))) return true;
            a.put(impronta);
            while (a.length() > 300) a.remove(0);
            sp.edit().putString("visti", a.toString()).commit();
        } catch (Exception e) {
            sp.edit().remove("visti").commit();
        }
        return false;
    }
}
