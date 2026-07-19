# eTransMed — Transmissions vocales pour infirmiers libéraux

App mobile (PWA) qui permet à un infirmier libéral (IDEL) de **dicter ses observations
patient par patient au fil de sa tournée** et de générer des **transmissions écrites
structurées** relues, validées, puis partagées au sein du cabinet.

> **Projet indépendant**, dans son propre dépôt `Neo-974/eTransMed`. Aucun lien avec le
> projet KK (SaaS élus locaux), qui vit dans un dépôt distinct.

---

## ⚠️ Version test — données FICTIVES uniquement

Cette version de test utilise **Supabase** et **Vercel**, qui **ne sont PAS des hébergeurs
de données de santé (HDS)** au sens de l'article L.1111-8 du Code de la santé publique.

**Il est donc interdit d'y saisir de vraies données patients.** Uniquement des données
fictives, pour démontrer le flux (Phase 1 « prototype » de la roadmap).

Le passage à de vraies données patients imposera une migration vers une infrastructure
**HDS** (ex. Clever Cloud) — cadré séparément, hors de cette version test.

---

## Flux fonctionnel

1. **Liste patients** (ordre alphabétique, patientèle du cabinet) — **ajout à la volée** possible.
2. **Sélection manuelle** du patient (identito-vigilance — jamais de reconnaissance vocale du nom).
3. **Dictée** : l'audio est **enregistré et conservé** (ré-écoutable).
4. **Transcription** de l'audio en texte.
5. **Relecture + correction + validation du passage** par l'IDE — rien n'est définitif sans validation.
6. Un même patient peut avoir **plusieurs passages dans la journée** (matin/soir…).
7. **Fusion chronologique** des passages du jour en une transmission unique horodatée.
8. **Validation finale** → la transmission devient visible par tout le cabinet.

## Stack

| Couche | Technologie |
|---|---|
| Frontend / PWA | Next.js 14 (App Router, TypeScript) déployé sur **Vercel** |
| Base de données | **Supabase** PostgreSQL |
| Authentification | **Supabase** Auth (email/mot de passe) |
| Stockage audio | **Supabase** Storage (bucket privé `passages-audio`) |
| Enregistrement audio | API navigateur `MediaRecorder` |
| Transcription | Route API `/api/transcribe` (moteur configurable via variable d'env) |
| Styles | Tailwind CSS |

## Démarrage local

### 1. Créer un projet Supabase
- Créez un projet sur https://supabase.com
- Dans **SQL Editor**, exécutez `supabase/schema.sql`
- Dans **Storage**, le script crée le bucket privé `passages-audio`
- Récupérez l'URL du projet et les clés (Settings → API)

### 2. Variables d'environnement
```bash
cp .env.example .env.local
# puis renseignez les valeurs Supabase
```

### 3. Lancer
```bash
npm install
npm run dev
# http://localhost:3000
```

## Déploiement Vercel
- Importez le dépôt sur Vercel, **Root Directory = `etransmed`**
- Renseignez les variables d'environnement (mêmes clés que `.env.local`)
- Deploy

## Structure
```
etransmed/
  app/                  Pages et routes API (Next.js App Router)
  lib/supabase/         Clients Supabase (navigateur + serveur)
  supabase/schema.sql   Schéma PostgreSQL + RLS + bucket Storage
  middleware.ts         Rafraîchissement de session + garde d'auth
```

## Roadmap
- **Phase 1 (cette version)** : prototype cliquable, données fictives, Supabase + Vercel.
- **Phase 2** : MVP conforme sur infra **HDS**, transcription/IA dans le périmètre HDS.
- **Phase 3** : production réelle (vrais IDEL, DPIA, juriste santé, conservation ≥ 5 ans).
