# Basile — app d'entretien des plantes

App personnelle de Bastien, dans l'esprit de Greg et Planta, mais gratuite et auto-hébergée.
Principe : les fonctionnalités utiles et importantes, sans fioritures. Interface en français, pensée d'abord pour iPhone.

## État actuel

`index.html` est l'app v2 en un seul fichier (HTML + CSS + JS, sans build) :

- deux vues : « Aujourd'hui » (tous les soins dus, groupés par plante, puis les 7 jours à venir) et « Mes plantes » (liste avec photo) ; une fiche par plante ;
- 21 types de plantes dans `SPECIES` : rythme d'arrosage été / hiver (hiver = octobre à mars), besoin en eau, lumière de référence, fiche (lumière, eau, humidité, toxicité), soins par défaut ;
- six soins par plante dans `p.cares` (`water`, `mist`, `fert`, `clean`, `turn`, `repot`), chacun avec `on`, `every`, `last`, `snooze` ; engrais d'avril à septembre, rempotage (en mois) de mars à septembre ;
- rythme d'arrosage suggéré = espèce ajustée par la lumière et le diamètre du pot (`suggestRhythm`), modifiable à la main ; quantité d'eau estimée selon le pot (`waterAmount`) ;
- météo Open-Meteo (sans clé, appelée depuis le front) : la chaleur rapproche les arrosages, la pluie compte comme un arrosage pour une plante marquée « dehors » ;
- journal photo par plante, photos réduites à 1280 px et stockées dans IndexedDB (base `basile`, magasin `photos`) ;
- identification et diagnostic par photo via `supabase/functions/vision/index.ts` (API Claude côté serveur). L'adresse et le mot de passe de la fonction se saisissent dans les réglages. **La fonction n'a jamais été déployée ni appelée pour de vrai** : le front a été testé contre une fausse réponse ;
- annulation, sauvegarde par export / import JSON (sans les photos) ;
- stockage dans `localStorage` (clé `basile.v2`, migration automatique depuis `basile.v1`), isolé derrière l'objet `store`.

La logique de dates travaille en jours entiers (`dayNum`, `dueDay`, `statusOf`, `seasonal`). L'interface a été testée dans Chromium au format iPhone, pas encore sur un vrai appareil.

## Cible : PWA auto-hébergée

Choix de Bastien : une PWA installable sur l'écran d'accueil de l'iPhone, hébergée sur son VPS, avec de vraies notifications push.

- **Front** : PWA (manifest + service worker). Sur iOS, le web push ne fonctionne que pour une PWA ajoutée à l'écran d'accueil (iOS 16.4+).
- **Backend** : Supabase auto-hébergé sur le VPS (OVHcloud, Ubuntu). Le VPS était en cours de commande au 11/11/2026 : vérifier qu'il est disponible avant de s'appuyer dessus.
- **Notifications** : Web Push (clés VAPID), envoi quotidien le matin des soins du jour. n8n tourne sur le même VPS et peut servir de planificateur.
- **Données** : remplacer `store` (localStorage) par Supabase, en gardant l'app utilisable hors ligne.

La pile technique du front (rester en fichier unique, ou passer à un framework) n'est pas décidée : à trancher avec Bastien. La v2 est restée en fichier unique en attendant. Restent à faire : manifest + service worker, notifications push, données dans Supabase.

## Fonctionnalités demandées (construites dans la v2)

Bastien a trouvé la v1 trop pauvre et a demandé tout ce qui suit. Tout est dans la v2 ; les points 5 et 6 attendent le déploiement de la fonction `vision` sur le VPS.

Soins à suivre, en plus de l'arrosage :

1. **Engrais** : rappel pendant la saison de croissance.
2. **Rempotage** : rappel tous les 1 à 2 ans.
3. **Brumisation et nettoyage** : brumiser, dépoussiérer les feuilles, tourner le pot.
4. **Quantité d'eau** : volume conseillé selon la taille du pot.

Fonctions intelligentes :

5. **Identification par photo** : photo de la plante, reconnaissance de l'espèce, réglage automatique du rythme.
6. **Diagnostic par photo** : photo d'une feuille abîmée, cause probable et quoi faire.
7. **Fiche et photos par plante** : fiche d'entretien (lumière, eau, humidité, toxicité) et journal photo de croissance.
8. **Météo et emplacement** : ajuster le rythme selon la lumière de la pièce et la météo locale.

Les points 5 et 6 demandent un modèle de vision appelé côté serveur (la clé d'API ne doit pas être dans le front). Le point 8 demande une API météo et la localisation.

## Choix de conception de la v2 (à faire valider par Bastien)

- Modèle de données par plante : type, pièce, diamètre du pot, niveau de lumière, puis une liste de soins (arrosage, engrais, brumisation, nettoyage, rempotage) avec chacun son intervalle, sa dernière date et un état activé ou non.
- Engrais uniquement d'avril à septembre ; brumisation activée par défaut seulement pour les espèces qui aiment l'humidité.
- Rythme d'arrosage suggéré = rythme de l'espèce ajusté par la lumière et la taille du pot, puis modifiable à la main.
- Deux vues : « Aujourd'hui » (tous les soins dus) et « Mes plantes » (liste avec photo), plus une fiche détaillée par plante.

## Conventions

- Textes de l'interface en français, tutoiement, phrases courtes.
- Thème clair et sombre via les variables CSS déjà définies dans `:root`.
- Pas de fioritures : chaque écran doit répondre à « qu'est-ce que je dois faire pour mes plantes aujourd'hui ? ».
