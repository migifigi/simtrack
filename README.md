# Suivi d'activité — Simond SA

Application de saisie d'occupation horaire pour les agents d'exploitation.

## Déploiement sur Vercel (gratuit, 10 min)

### 1. Créer un compte Vercel
- Aller sur [vercel.com/signup](https://vercel.com/signup)
- Choisir "Continue with Email" (le plus simple)
- Confirmer l'email

### 2. Installer le projet localement (ou utiliser Vercel directement)

#### Option A — Le plus simple (zéro installation)
1. Crée un compte gratuit sur [github.com](https://github.com) (si tu n'en as pas)
2. Crée un nouveau dépôt (repo) public, par exemple `simond-suivi`
3. Glisse-dépose **TOUS les fichiers** de ce projet dans le repo via l'interface web GitHub
4. Sur Vercel, clique "Add New..." → "Project" → connecte ton GitHub → sélectionne `simond-suivi`
5. Vercel détecte automatiquement Vite → clique "Deploy"
6. ✅ En 2 minutes, tu obtiens une URL du type `simond-suivi.vercel.app`

#### Option B — Pour les utilisateurs avancés
```bash
npm install
npm run dev   # test local sur http://localhost:5173
npm run build # génère le dossier dist/
```

Puis déployer le dossier `dist/` sur Vercel via leur CLI ou interface.

## Configuration de la sauvegarde Google Sheets

Voir le fichier `google_apps_script.js` à part — instructions complètes en haut du fichier.

## Stockage

- **Sans Google Sheets configuré** : données dans le navigateur de chaque utilisateur (localStorage)
- **Avec Google Sheets** : sauvegarde automatique dans le Sheet partagé de Miguel

## Personnalisation

Tout est éditable dans `src/App.jsx` :
- Couleurs : variables `NAVY`, `BLUE`, `ORANGE` en haut du fichier
- Catégories par défaut : tableau `DEFAULT_TAGS`
- Plage horaire par défaut : 6h-19h, créneaux 30 min (modifiables dans Paramètres)
