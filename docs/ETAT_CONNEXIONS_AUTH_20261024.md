# Boissy UJ — État réel des connexions, inscription et permissions

**Audit du 24 octobre 2026 — GitHub `main` et Supabase de production en lecture seule.**
**Ce document ne vaut pas homologation de l'authentification réelle.**

## Contrôles techniques constatés

- `auth-config.mjs` pointe vers le projet Supabase Boissy-UJ actif, avec une clé **publishable**, jamais une clé `service_role`.
- `auth.mjs` propose connexion par e-mail/mot de passe, inscription au rôle Supporter, déconnexion, renvoi de confirmation, récupération du mot de passe et nouvel identifiant de session PKCE.
- Le déclencheur `trg_boissy_signup` est présent sur `auth.users` (1) ; les tables `profiles` (3 politiques) et `user_roles` (1 politique) ont RLS actif. Toutes les 20 tables exposées dans le schéma `public` ont RLS actif.
- `app_private.is_admin()` est présente ; le code de la migration exige à la fois un rôle `admin` serveur et un JWT `aal2` pour l'administration.
- Les nouvelles protections contre les **anciennes réponses de formulaires** empêchent qu'un résultat de connexion, inscription ou récupération terminé tard remplace le formulaire actuellement utilisé.
- Aucun compte de test ni identité personnelle n'a été lu, créé ou supprimé durant cet audit ; aucune écriture SQL ni e-mail réel n'a été déclenché.

## À vérifier dans le tableau de bord Supabase (non prouvable via les métadonnées SQL consultées)

1. **Auth → URL Configuration** : `Site URL` correspondant à `https://diegosmp94.github.io/Boissy-UJ/` et URL de redirection autorisée **identique, sans `#/mon-espace`**. Le routeur conserve le paramètre PKCE `?code=...` jusqu'à l'échange par Supabase.
2. **Auth → Providers → Email** : méthode de connexion e-mail activée, confirmation des comptes selon décision du club, modèle de confirmation cohérent avec le flux client PKCE et liens de récupération corrects.
3. **Auth → SMTP Settings** : service de messagerie sortante correctement configuré ou limites et restrictions de l'expéditeur Supabase connues ; vérifier réellement confirmation, renvoi, mot de passe oublié, boîte de réception, indésirables et limites de fréquence. Ne pas transmettre de mot de passe SMTP dans Git ou ChatGPT.
4. **Auth → Security / MFA** : TOTP réellement inscrit et vérifié pour les comptes administrateurs ; session à `aal1` refusée avant l'étape à `aal2`.
5. **Délivrabilité et sécurité des sessions** : connexion/déconnexion, reprise de session, expiration et réinitialisation sur un vrai iPhone Safari, un Android et un navigateur ordinateur.
6. **RLS et rôles** : tester **sept comptes fictifs sur une instance isolée**, avec deux joueurs et deux éducateurs affectés à des équipes distinctes, un administrateur MFA et un compte cumulant les rôles, puis conserver un compte rendu des succès et des refus.
7. **Suppression des données et RGPD** : vérifier les modalités d'accès/effacement des comptes et consentements, particulièrement pour les informations de mineurs ; faire valider les mentions légales du club.
8. **Conseils de sécurité Supabase** : 28 avertissements concernant des fonctions `SECURITY DEFINER` exécutables par une session authentifiée ; contrôler leurs gardes internes et preuves négatives. Ces avertissements **ne prouvent pas à eux seuls une faille**.

## Limites d'accès et de recette

- Le connecteur Supabase interrogé expose le projet, les tables, les métadonnées SQL et les advisors, **pas les réglages vérifiés d'Auth URL / SMTP du Dashboard** : ces cases restent « à vérifier », pas « validées ».
- Il ne faut **pas** générer de nouveaux comptes ni envoyer des e-mails sur la production pour remplir une recette de staging.
- Le test local `npm run smoke:real-permissions` est protégé pour refuser la production et n'a pas encore été exécuté avec sept comptes autorisés.
- Aucun paiement LIVE n'est activé ; Premium ne constitue pas un rôle déclarable à l'inscription.
- Publication technique du site et disponibilité du formulaire **ne constituent pas** une preuve que les mails, les sessions et les droits des utilisateurs fonctionnent en conditions réelles.

## Critères de clôture

Le chantier « Comptes et permissions » reste P1 tant que les éléments 1 à 8 ne sont pas vérifiés ou explicitement homologués, notamment le PV multi-comptes et les contrôles réellement refusés. Le prochain chantier de développement doit cibler les défauts observés pendant ces recettes sans détendre la sécurité.
