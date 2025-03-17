# Discord Job Bot avec Supabase

Un bot Discord pour gérer les offres de travail pour des codeurs, utilisant Supabase comme base de données.

## Fonctionnalités

- Création d'offres de travail par les administrateurs
- Publication d'offres dans un canal dédié
- Acceptation des offres par les codeurs
- Création automatique de canaux privés pour chaque projet
- Limitation à un travail actif par codeur
- Marquage des travaux comme terminés

## Installation

1. Cloner ce repo
```bash
git clone https://github.com/your-username/discord-job-bot.git
cd discord-job-bot
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer Supabase
   - Créer un projet dans Supabase
   - Exécuter le script SQL dans `database/migrations.sql` pour créer les tables nécessaires
   - Copier l'URL et la clé API de Supabase

4. Créer un fichier `.env` avec les variables suivantes:
```
DISCORD_TOKEN=your_discord_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

5. Démarrer le bot
```bash
npm start
```

## Commandes

### Administrateurs
- `$order add` - Démarrer la création d'une nouvelle offre de travail
- `$order list [status]` - Lister les offres (OPEN, ASSIGNED, COMPLETED, ALL)
- `$order cancel <id>` - Annuler une offre existante

### Codeurs
- Bouton "Accepter ce travail" sur les offres publiées
- Bouton "Marquer comme terminé" dans les canaux de projet

## Structure du Projet

- `index.js` - Point d'entrée principal
- `config/` - Configuration du bot et Supabase
- `commands/` - Commandes disponibles
- `events/` - Gestionnaires d'événements Discord
- `interactions/` - Gestionnaires pour les boutons et menus
- `database/` - Interface avec Supabase
- `utils/` - Utilitaires divers

## Tech Stack

- discord.js - API Discord
- @supabase/supabase-js - Client Supabase
- winston - Logging
- dotenv - Gestion des variables d'environnement