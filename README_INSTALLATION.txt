L&A — SITE EN LIGNE / BOÎTE À IDÉES / SUIVI

1) Installer Node.js 18+.
2) Ouvrir un terminal dans ce dossier.
3) Lancer : npm install
4) Copier .env.example vers .env.
5) Pour commencer sans mail : laisser SMTP_USER/SMTP_PASS vides. La boîte à idées fonctionne quand même et les données sont stockées côté serveur.
6) Lancer : npm start
7) Ouvrir : http://localhost:3000

BOÎTE À IDÉES
- Les idées sont enregistrées dans data/ideas.json.
- Chaque idée reçoit une référence LA-2026-XXXXXX.
- Le site affiche immédiatement la référence à l'élève.
- Aucun nom/email n'est demandé.

SUIVI
- Page « Suivi » dans le menu.
- L'élève saisit sa référence pour consulter son statut.
- Statuts : NOUVELLE / EN ÉTUDE / TRANSMISE / RÉPONSE OBTENUE.
- La modification des statuts se fait via l'API protégée par ADMIN_TOKEN.

MAILS
- Le code est prêt pour Nodemailer/Microsoft 365.
- NE PAS mettre de mot de passe dans le site ni dans le dépôt public.
- Demander au professeur/administrateur si SMTP AUTH est autorisé pour le compte utilisé.

MISE EN LIGNE
- Le dossier peut être déployé sur un hébergeur Node.js.
- Configurer les variables d'environnement sur l'hébergeur.
- Pour une vraie utilisation publique, utiliser un stockage persistant (volume/disque ou base de données) plutôt qu'un système de fichiers éphémère.
- HTTPS est indispensable en production.
