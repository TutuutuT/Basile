# Basile

App personnelle d'entretien des plantes : arrosage, engrais, brumisation, nettoyage, rempotage, fiche et journal photo par plante, météo locale, identification et diagnostic par photo.

## Lancer l'app

Ouvre `index.html` dans un navigateur, ou sers le dossier :

```bash
python3 -m http.server 8000
```

Tout est enregistré dans le navigateur (plantes dans `localStorage`, photos dans IndexedDB). La météo vient d'Open-Meteo, sans clé. La position et la caméra demandent une page servie en HTTPS (ou `localhost`).

## Photos intelligentes : la fonction `vision`

L'identification et le diagnostic par photo appellent un modèle de vision (API Claude). La clé d'API reste sur le serveur, dans la fonction `supabase/functions/vision/index.ts`.

Variables d'environnement de la fonction :

| Variable | Rôle |
| --- | --- |
| `ANTHROPIC_API_KEY` | clé de l'API Claude |
| `BASILE_TOKEN` | mot de passe que tu choisis, à saisir aussi dans l'app |
| `BASILE_ORIGIN` | adresse de l'app pour CORS, par exemple `https://basile.exemple.be` (facultatif) |

Sur un Supabase auto-hébergé (Docker), copie le dossier `supabase/functions/vision` dans `volumes/functions/`, ajoute les variables au service `functions`, puis redémarre-le. L'app s'authentifie avec l'en-tête `X-Basile-Token`, pas avec un JWT Supabase : la vérification JWT des fonctions doit être coupée (`FUNCTIONS_VERIFY_JWT=false` dans le `.env` de Supabase). Ces étapes n'ont pas encore été essayées sur le VPS.

Dans l'app, ouvre les réglages et renseigne :

- l'adresse de la fonction, par exemple `https://ton-serveur/functions/v1/vision` ;
- le mot de passe (`BASILE_TOKEN`).

Chaque photo analysée est un appel payant à l'API.
