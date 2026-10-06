# FITCUT - Gym & Diet

PWA pronta per GitHub Pages. Non richiede Play Store.

## Pubblicazione con GitHub Pages
1. Crea un repository pubblico, ad esempio `fitcut-app`.
2. Carica **tutto il contenuto di questa cartella nella root** del repository.
3. GitHub -> Settings -> Pages -> Deploy from branch -> `main` -> `/root` -> Save.
4. Apri l'URL Pages sul Nothing Phone 3 con Chrome.
5. Menu Chrome -> **Aggiungi a schermata Home** (o Installa app, se disponibile).

## Funzioni
- 4 giorni palestra, gambe tutti i giorni, core tutti i giorni.
- Recupero grande e visibile in ogni esercizio.
- +/- modificabile a passi configurabili e campo numerico diretto.
- "Serie fatta -> TIMER" avvia automaticamente il recupero.
- Checklist serie e salvataggio locale.
- Tre modelli alimentari + quota flessibile.
- Registro peso e girovita.
- Offline dopo la prima apertura tramite service worker.

## Nota sul timer su telefono bloccato
Il browser può sospendere pagine web quando lo schermo è bloccato. Il timer è basato su timestamp, quindi riallinea il conto al ritorno in primo piano; non è possibile garantire un beep durante ogni blocco schermo senza un'app nativa.
