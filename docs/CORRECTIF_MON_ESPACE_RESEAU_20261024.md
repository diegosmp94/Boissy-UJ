# Correctif prioritaire après mise en ligne — Fiabilité de « Mon espace »

**24 octobre 2026 — Intervention client uniquement.**

## Constat et périmètre

La version `f776646524074079b2bbb20eaca71faae092d23c` de Boissy-UJ a été **effectivement publiée** après ajustement de GitHub Pages : les jobs `build`, `deploy` et `verify` ont réussi et **11/11** contrôles HTTP ont répondu correctement. Le fichier `release.json` confirme le SHA `main`. Ce succès atteste uniquement la livraison des fichiers publics, **pas** les sessions et droits réels.

Dans `auth.mjs`, le téléchargement de la bibliothèque Supabase, la lecture de session, le profil, les rôles et les actions de connexion/reconnexion utilisaient des promesses **sans limite de durée**. En cas de panne CDN, de réseau lent ou d'appel Supabase non résolu, l'écran « Vérification de la session sécurisée… » ou le bouton d'envoi désactivé pouvait rester bloqué indéfiniment.

## Réparation du flux public de compte

La bibliothèque `auth-resilience.mjs` fixe une limite de **12 secondes** aux promesses du parcours compte, y compris aux réponses `thenable` de la bibliothèque Supabase. Elle nettoie son minuteur lorsque l'opération se termine. Les erreurs ne contiennent ni données saisies ni secrets.

- Import jsDelivr du client Supabase : délai fini, puis **nouvel essai possible** au prochain chargement.
- Connexion et inscription : retour à un bouton actif, avis d'indisponibilité non sensible.
- Récupération de mot de passe, renvoi de confirmation et définition d'un nouveau mot de passe : retour à un état stable après erreur ou timeout.
- `getSession`, `getUser`, profil et rôles : en cas d'indisponibilité, affichage d'une carte « Connexion temporairement indisponible » avec bouton **Réessayer**.
- Déconnexion : en cas de refus réseau, le bouton est réactivé, et l'interface ne **prétend pas** que la déconnexion a réussi.
- Les contrôles précédents de changement de route et de génération de vue continuent d'ignorer les réponses tardives.
- Aucun élargissement des rôles, aucune migration, aucun mot de passe manipulé ou utilisateur fictif créé en production.

Les timeouts du client **ne stoppent pas physiquement** une opération déjà envoyée au serveur : une action comme l'inscription peut aboutir tardivement. La réponse n'est pas considérée comme la preuve d'un échec serveur définitif. Si l'utilisateur reçoit un mail de confirmation malgré une alerte, il suit le flux habituel du club.

## Recette et limites

- Tests automatiques : succès immédiat, requête qui ne se résout pas, rejet serveur, réponse tardive, garde-fous contre identifiants/secrets, inspection des parcours d'inscription/connexion, contrôle du bouton Réessayer et statut de session.
- Les **16 parcours publics Chromium** doivent toujours passer, y compris l'accueil, la page de compte et les interactions clavier/mobiles anonymes.
- Les tests GitHub Pages vérifient le nouveau SHA une fois la PR fusionnée dans `main`.
- La validation **réelle** connexion/inscription/réinitialisation avec comptes de test, MFA et RLS nécessite toujours le staging isolé déjà prévu ; pas de preuve de création d'utilisateur réel par ce correctif.

**Statut : code prêt à la recette CI, homologation multi-comptes et capacités de Supabase non présumées.**
