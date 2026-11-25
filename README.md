# Finanze (app Android)

App personale per il budget: ogni giorno dice quanto si può spendere fino al prossimo stipendio.

- Legge da sola le notifiche di **Google Pay** e segna le spese.
- Legge le mail di **MPS** (saldo del mattino, pagamenti con carta e prelievi, addebiti, stipendio) e di **PayPal** dalle notifiche di Gmail. Se una spesa della mail c'è già la riconosce, se manca la segna.
- Se un giorno sfori, quello in più lo toglie dai giorni dopo e mostra quanto puoi spendere da domani.
- La carta di credito conta tra le spese del mese dopo e si divide su tutto il mese.
- I dati restano solo sul telefono (l'app non usa internet). Nessun dato personale è in questo progetto.

L'APK si crea da solo con GitHub Actions a ogni modifica e finisce in `apk/Finanze.apk`.
