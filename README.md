# Ecce Decision Game

Application web simple pour animer un jeu de décision collective en atelier, avec :

- import / préchargement du fichier Excel participants
- génération automatique des équipes et des cartes
- liens individuels et QR codes
- vue mobile par participant
- vote individuel A/B remonté en direct dans l'admin
- vue animateur avec vérité des cartes
- onglet admin avec la constitution complète des équipes
- fiche de restitution imprimable / exportable en PDF
- mode intrus avec 2 taupes par équipe et soupçons live

## Lancement rapide

```bash
npm install
npm run refresh:data
npm run start
```

Le serveur local démarre ensuite sur :

- `http://localhost:3000/`
- et sur ton IP locale si tu es sur le même réseau local

Pour demain :

1. Ouvre l'URL locale ou réseau sur ton ordinateur.
2. Colle l'URL réellement utilisée dans le champ `URL d'infiltration à injecter dans les QR codes`.
3. Vérifie les équipes, les cartes et les onglets admin.
4. Ouvre la matrice QR.
5. Imprime ou exporte en PDF.
6. Les participants scannent leur QR code et voient directement leur carte.
7. Les votes individuels A/B remontent automatiquement dans l'onglet `Réponses live`.

## Fichier Excel utilisé

Le projet est déjà prêt avec le fichier réel fourni :

- `public/data/smilebox.xlsx`

L'app démarre donc immédiatement sur le groupe Smilebox.

## Si tu veux remplacer le groupe

Mode le plus fiable pour un usage multi-smartphone :

1. Remplace `public/data/smilebox.xlsx` par ton nouveau fichier.
2. Lance `npm run refresh:data`.
3. Relance `npm run start`.
4. Regénère les QR codes.

Le bouton d'import dans l'admin est utile pour tester localement un autre Excel sur ton poste.

## Votes et partage local

- En local, l'application n'a pas besoin de base de données externe.
- Le serveur stocke la session et les votes partagés dans `.runtime/shared-state.json`.
- Tant que les appareils ouvrent le même serveur local, ils partagent le même état.

## Bascule Supabase + Vercel

Le projet est maintenant prêt pour un déploiement Vercel avec état persistant dans Supabase.

Principe :

- le front Vite reste identique
- les appels `/api/...` restent identiques
- en local sans variables d'environnement Supabase, l'app continue d'utiliser `.runtime/shared-state.json`
- dès que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont présents, l'état partagé bascule automatiquement vers Supabase

### 1. Créer le projet Supabase

1. Crée un projet sur Supabase.
2. Ouvre l'éditeur SQL.
3. Exécute le contenu de :

```text
supabase/schema.sql
```

Cette table stocke :

- le snapshot de jeu
- les votes
- les désignations d'intrus

### 2. Récupérer les variables Supabase

Dans Supabase, récupère :

- `Project URL`
- `service_role key`
- `anon key` ou `publishable key`

### 3. Tester localement avec Supabase

Copie le modèle :

```bash
cp .env.example .env
```

Puis renseigne `.env` avec :

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxx
PORT=3000
```

Puis lance :

```bash
npm run start
```

Tant que ces variables sont présentes :

- le serveur local écrit dans Supabase au lieu du fichier `.runtime/shared-state.json`
- le front s'abonne à Supabase Realtime
- le polling `/api/state` en boucle est désactivé

Concrètement :

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` servent au serveur pour lire/écrire
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` servent au navigateur pour écouter les événements Realtime

### 4. Déployer sur Vercel

Le projet contient déjà :

- `vercel.json`
- les fonctions serverless dans `api/`

Déploiement :

```bash
npm install -g vercel
vercel
vercel --prod
```

### 5. Ajouter les variables d'environnement dans Vercel

Dans le dashboard Vercel, ajoute :

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxx
```

Puis relance un déploiement de production :

```bash
vercel --prod
```

### 6. Vérifier la prod

Après déploiement :

1. ouvre l'URL Vercel
2. colle cette URL dans le champ `URL d'infiltration à injecter dans les QR codes`
3. régénère le pack QR
4. teste une carte joueur
5. teste un vote
6. teste une désignation de 2 intrus
7. vérifie l'admin et le dossier animateur

## Déploiement via GitHub + synchro Vercel

Le flux recommandé pour toi maintenant :

1. le code vit dans GitHub
2. Vercel est connecté au dépôt GitHub
3. chaque push sur `main` redéploie automatiquement la prod
4. chaque branche peut générer un preview deploy

### 1. Préparer le dépôt local

Le projet contient désormais un `.gitignore` qui exclut notamment :

- `.env`
- `.runtime/`
- `node_modules/`
- `dist/`

Initialisation locale :

```bash
git init
git add .
git commit -m "Initial EcceGame release"
git branch -M main
```

### 2. Créer le dépôt GitHub

Crée un dépôt vide sur GitHub, puis connecte ton projet local :

```bash
git remote add origin https://github.com/TON-COMPTE/ecce-game.git
git push -u origin main
```

### 3. Importer le dépôt dans Vercel

Deux options :

- depuis le dashboard Vercel : `New Project` puis sélection du dépôt GitHub
- ou en CLI une fois le repo git en place :

```bash
vercel
```

### 4. Configurer le projet Vercel

Lors de l'import :

- framework : `Vite`
- build command : `npm run build`
- output directory : `dist`

Le projet contient déjà `vercel.json`, donc la config est en place.

### 5. Ajouter les variables Supabase dans Vercel

Ajoute dans Vercel :

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxx
```

En pratique tu peux le faire :

- dans `Project Settings > Environment Variables`
- ou via CLI :

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_ANON_KEY preview
```

### 6. Déployer et synchroniser

Premier déploiement prod :

```bash
vercel --prod
```

Ensuite, le flux quotidien devient :

```bash
git add .
git commit -m "Mon changement"
git push origin main
```

À chaque push sur `main`, Vercel redéploie automatiquement la production.

## Migration Realtime

Le projet utilise désormais une stratégie hybride :

- `GET /api/state` uniquement au chargement initial
- les écritures restent validées par les endpoints `/api/...`
- chaque écriture diffuse ensuite un événement Supabase Realtime
- si Realtime n'est pas configuré côté navigateur, l'app retombe automatiquement sur le polling local

Événements diffusés :

- remplacement du snapshot
- vote verrouillé
- désignation d'intrus
- remise à zéro votes + soupçons

### 7. Vérification finale

Après le premier déploiement :

1. ouvre l'URL Vercel
2. vérifie qu'une carte joueur s'ouvre bien
3. teste un vote
4. teste une désignation de 2 intrus
5. vérifie que l'admin reflète bien les votes et les soupçons
6. colle ensuite cette URL Vercel dans le champ `URL d'infiltration à injecter dans les QR codes`
7. régénère le pack QR

## Parcours disponible

- `/` : admin
- `/?card=...` : carte mobile individuelle
- `/?facilitator=...` : pack animateur d'une équipe
- `/?restitution=...` : fiche de restitution d'une équipe
- `/?sheet=qrs` : planche QR imprimable

## Tech

- Vite
- React
- TypeScript
- Express
- Vercel serverless functions
- Supabase
- `xlsx`
- `qrcode`
