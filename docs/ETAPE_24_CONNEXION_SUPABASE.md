# Étape 24 — Réouverture contrôlée de Mon espace

## Objectif
Redonner accès aux comptes supporters sur le site public Boissy-UJ tout en laissant les fonctions administratives sensibles sous verrou.

**Changements :**
- `auth-config.mjs`: `enabled:true` pour les comptes de supporters, `adminEnabled:false` pour les éditeurs d’effectifs / de contenu et la modération administrative.
- Login / inscription e-mail-mot de passe / déconnexion / mot de passe oublié. Les formulaires sont validés avant appel à Supabase, les erreurs ne divulguent pas de données sensibles.
- Le client conserve le flux sécurisé **PKCE** et une session persistante. Il abonne les événements d'authentification **avant** la lecture de session, pour capter la récupération de mot de passe.
- Les liens e-mail ciblent la racine GitHub Pages `https://diegosmp94.github.io/Boissy-UJ/` **sans hash** : Supabase utilise le `?code=...`, et le site reroute localement vers `#/mon-espace` tout en préservant le code pour la bibliothèque d’authentification.
- Le site ne crée pas d’administrateur à l’inscription : le trigger côté serveur ne confère que le rôle `supporter`.
- Aucun paiement n'est activé.

## Configuration Supabase Auth à vérifier obligatoirement
Certaines options de **GoTrue Auth** ne sont pas exposées dans les outils de lecture/édition de configuration de ce projet. Les migrations SQL ou les RLS ne modifient pas la configuration de redirection des e-mails. Une mise en ligne du code **ne prouve donc pas** qu’un e-mail de confirmation ou de récupération sera effectivement délivré.

Dans [Supabase Dashboard — URL Configuration](https://supabase.com/dashboard/project/dahzewvbybujqhogumte/auth/url-configuration) :
1. Configurer **Site URL** à `https://diegosmp94.github.io/Boissy-UJ/`.
2. Ajouter la même URL exacte aux **Redirect URLs** si nécessaire.
3. Vérifier les modèles d’e-mail (Confirmation / Recovery) et leur redirection `{{ .RedirectTo }}` lorsqu'elle est utilisée dans le modèle.
4. Vérifier que le fournisseur **Email** et l’inscription sont autorisés, que les expéditeurs et SMTP / limites d’envoi conviennent et que la confirmation par e-mail est appliquée selon la politique du club.
5. Tester sur le domaine final sans le `#/mon-espace` dans le redirect URL Supabase : l'application se charge de la navigation après la réception du callback.

Voir [documentation Supabase sur les Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) et [réinitialisation par e-mail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

## Tests automatiques
- Validation e-mail, nom public et mot de passe.
- Détection des callbacks PKCE sans révéler les paramètres ni perdre le code.
- Traitement d'événement `PASSWORD_RECOVERY` et intention locale sans jeton.
- Vérification de rôle et lecture du compte via `getUser`.
- Drapeau séparé des fonctions d'administration, MFA et permissions Supabase existantes inchangés.
- Tests de non-régression GitHub Actions.

## Vérification opérationnelle restante
La connexion **réelle**, la création de compte, la distribution des e-mails et les retours de récupération nécessitent une recette navigateur sur le domaine final avec un compte de test appartenant au club. Aucun compte fictif n’est créé dans Supabase par ce déploiement. Un test unitaire ou une compilation réussie ne remplace pas cette recette E2E.

Un lancement ultérieur de la modération et des outils administrateurs nécessitera une recette séparée MFA AAL2 / autorisations / journaux et la réouverture explicite du drapeau `adminEnabled`.
