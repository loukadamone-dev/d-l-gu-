L&A — VERSION POSTGRESQL + ESPACE PRIVÉ

Cette version supprime la dépendance au SMTP pour le fonctionnement de la boîte à idées.
Les idées et messages sont enregistrés dans PostgreSQL. L'e-mail est facultatif et ne bloque jamais un envoi.

1. Variables Render
- DATABASE_URL : utiliser l'Internal Database URL de votre PostgreSQL Render.
- ADMIN_TOKEN : créer un code privé connu uniquement des délégués.
- Ne jamais mettre ces valeurs dans GitHub ni les envoyer dans une conversation.

2. Déploiement
- Le service lance `npm install` puis `node server.js`.
- La dépendance `pg` est déjà dans package.json.
- Au démarrage, les tables PostgreSQL `ideas` et `contacts` sont créées automatiquement.

3. Boîte à idées
- L'élève dépose une idée anonyme.
- Elle est enregistrée immédiatement en PostgreSQL.
- Une référence `LA-2026-XXXXXX` est retournée.
- Le suivi public affiche uniquement le statut et la référence.

4. Espace privé
- Ouvrir `#admin` ou cliquer sur « Espace délégués » en bas du site.
- Entrer ADMIN_TOKEN.
- Le serveur crée une session HttpOnly ; le token n'est jamais stocké dans le navigateur.
- Le tableau de bord permet de voir les idées/messages, modifier le statut, ajouter une réponse et supprimer une idée.

5. SMTP
- SMTP est optionnel.
- S'il est configuré et qu'il échoue, les données restent quand même enregistrées.
- Pour le moment, vous pouvez laisser SMTP_USER/SMTP_PASS vides.

6. Important
- PostgreSQL doit être relié au Web Service Render avec DATABASE_URL.
- Ne partagez jamais DATABASE_URL ou ADMIN_TOKEN.
