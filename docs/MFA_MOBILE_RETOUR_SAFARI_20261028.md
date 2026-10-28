# Correctif AA2F/MFA sur iPhone : revenir dans Safari après le code

## Mode d'emploi

1. Ouvrir **Boissy-UJ → Mon espace**, se connecter avec un compte ayant le rôle technique **Administrateur**.
2. Dans **Double authentification**, cliquer sur « Configurer ou vérifier le second facteur » et attendre l'affichage du champ à six chiffres.
3. **Sans fermer l'onglet Safari**, passer à l'application d'authentification (via le sélecteur d'applications de l'iPhone).
4. Lire le **code actuel** dans l'application, puis revenir au **même onglet Safari**.
5. Saisir le code et choisir « Vérifier le code et ouvrir l'accès », puis ouvrir le Centre de gestion.

La fenêtre MFA reste montée pendant un aller-retour iOS : ni `focus`, ni `visibilitychange`, ni un événement `SIGNED_IN` de rafraîchissement de session ne doit reconstruire le formulaire en cours. L'utilisateur peut consulter le code et revenir sans perdre le facteur sélectionné. Une revérification discrète de l'identité, du rôle admin et de l'état MFA continue d'être effectuée au retour.

## Sécurité

- Aucune copie du code ni du secret MFA en stockage local ou sessionStorage ; le facteur est conservé **en mémoire de page** seulement.
- Une vraie déconnexion, un changement de compte ou une révocation du rôle `admin` remplace toujours le formulaire par une nouvelle vérification.
- Une interruption transitoire du réseau n'est pas considérée comme une déconnexion confirmée : le formulaire reste disponible, mais les actions sensibles demeurent protégées par les contrôles Supabase et AAL2.
- L'accès au Centre de gestion n'est **jamais** accordé par le navigateur, uniquement après vérification du code et du niveau AAL2 côté Supabase.
- Si iOS ferme réellement ou recharge l'onglet pour économiser de la mémoire, l'état temporaire du formulaire peut être perdu. Pour un facteur déjà enregistré, la sélection peut être recommencée sans créer de nouveau secret. Ne pas promettre une récupération des données non sauvegardées après un rechargement complet.

## Recette humaine à réaliser

Sur iPhone réel, tester :
- Passage Safari → application TOTP → Safari sans rechargement ;
- Event `SIGNED_IN`/rafraîchissement de session pendant le passage en arrière-plan ;
- Expiration du code et nouvelle tentative ;
- Déconnexion explicite et retrait du rôle admin pendant l'absence ;
- Temps d'inactivité suffisant pour provoquer une éventuelle suspension iOS.

La CI couvre les règles du flux et l'absence de régression des routes publiques. La vérification du basculement entre **deux applications iOS physiques** nécessite une recette humaine.
