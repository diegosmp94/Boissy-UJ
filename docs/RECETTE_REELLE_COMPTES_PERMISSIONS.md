# Recette réelle — comptes et permissions Boissy-UJ

## Objet et sécurité

Le script `scripts/real-permissions-smoke.mjs` teste les sessions Auth réelles, les rôles présents dans `public.user_roles`, le cloisonnement Joueur/Entraîneur, et l'exigence AAL2 du Control Center.

Le script est **lecture seule pour les données métier** : il ne crée aucun compte, rôle, équipe, match, affectation ou convocation ; il n'approuve ni ne révoque aucun rôle. Il ouvre des sessions avec les comptes déjà fournis pour le test, effectue les challenges TOTP configurés, puis demande leur déconnexion locale. Les mots de passe, secrets TOTP, jetons et adresses ne sont jamais imprimés ni écrits dans un fichier.

Les protections d'exécution exigent simultanément :

- `BOISSY_TEST_ENVIRONMENT=test` ;
- la phrase de confirmation `YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_STAGING` ;
- une URL HTTPS correspondant exactement à `BOISSY_TEST_PROJECT_REF` ;
- un identifiant de projet différent du projet de production `dahzewvbybujqhogumte` ;
- une clé `sb_publishable_...` ou l'ancienne clé `anon`, jamais une clé `service_role` ou `sb_secret_...`.

**Ne pas retirer ces gardes et ne jamais exécuter la recette sur le projet de production.** Aucun accès de connexion ou identité du club ne doit être utilisé à la place des comptes de test autorisés.

## Comptes déjà nécessaires

Le propriétaire du projet de test doit fournir des comptes distincts déjà présents et autorisés :

| Alias | Rôles attendus | Affectation requise |
|---|---|---|
| `supporter` | `supporter` | Aucune |
| `playerA`, `playerB` | `supporter`, `player` | Joueurs de deux équipes de test distinctes |
| `coachA`, `coachB` | `supporter`, `coach` | Coach A affecté à l'équipe A, coach B à l'équipe B |
| `admin` | `supporter`, `admin` | Facteur TOTP vérifié |
| `tripleRole` | `supporter`, `player`, `coach`, `admin` | Affectation coach à l'équipe A et facteur TOTP vérifié |

Les comptes doivent avoir une adresse e-mail confirmée. Chaque rôle attendu est comparé à la session et à la base ; le script n'attribue ni ne corrige des rôles. Les comptes multi-rôles et TOTP doivent être préparés avant cette recette par le responsable du projet de test.

Les variables d'environnement sont le seul canal d'entrée des secrets. Ne pas les enregistrer dans Git, dans `package.json`, dans un fichier `.env` versionné, dans une capture ou dans un rapport. `BOISSY_TEST_PERSONAS_JSON` a la forme suivante, avec des valeurs issues des comptes autorisés :

```json
{
  "supporter": {"email": "…", "password": "…", "roles": ["supporter"]},
  "playerA": {"email": "…", "password": "…", "roles": ["supporter", "player"]},
  "playerB": {"email": "…", "password": "…", "roles": ["supporter", "player"]},
  "coachA": {"email": "…", "password": "…", "roles": ["supporter", "coach"]},
  "coachB": {"email": "…", "password": "…", "roles": ["supporter", "coach"]},
  "admin": {"email": "…", "password": "…", "roles": ["supporter", "admin"], "totpSecret": "…"},
  "tripleRole": {"email": "…", "password": "…", "roles": ["supporter", "player", "coach", "admin"], "totpSecret": "…"}
}
```

`totpSecret` est le secret TOTP Base32 du compte de test, pas un code à six chiffres. Si un compte dispose de plusieurs facteurs TOTP vérifiés, préciser aussi son `factorId` déjà vérifié.

## Équipes et données déjà présentes

`BOISSY_TEST_FIXTURES_JSON` indique les codes des équipes existantes dans le projet de test :

```json
{"teamA":"a","teamB":"b"}
```

Les codes doivent désigner deux équipes distinctes déjà présentes. Pour prouver l'isolation de convocations entre les deux joueurs, ajouter deux identifiants **déjà existants** de matchs distincts auxquels seul le joueur correspondant est convoqué : `playerAExclusiveMatchId` et `playerBExclusiveMatchId`. La recette se termine avec le code `2` si cette preuve est omise ; elle n'est alors pas complète.

Le script ne demande pas de créer de matchs ou de convocations pour remplir ces critères. Sans lignes déjà présentes et autorisées dans un environnement de test, la preuve correspondante reste « non exécutée ».

## Scénarios automatisés

1. Connexion mot de passe par compte, identité retournée par Auth, confirmation e-mail et liste exacte des rôles personnels.
2. Appel anonyme refusé sur une RPC privée d'équipe.
3. Supporter : accès admin et entraîneur refusé ; aucune convocation Joueur retournée.
4. Joueur A et Joueur B : lecture de leur propre liste ; isolation par deux matchs distincts si ces identifiants réels sont configurés.
5. Coach A/B : accès à ses propres rencontres et refus de l'équipe opposée.
6. Administrateur à AAL1 : lecture administrative refusée ; après challenge TOTP, AAL2 est attesté dans le JWT et la lecture admin réussit.
7. Triple rôle : conserve le contexte Joueur, le périmètre Entraîneur, et l'accès Admin seulement après MFA AAL2.
8. Les sessions sont déconnectées localement à la fin, y compris après un échec.

Le script **n'exécute aucune mutation métier**. L'auto-approbation, les révocations, l'attribution d'un rôle et la réponse ou création d'une convocation ne sont pas appelées, car ces opérations changeraient l'état des comptes ou des données. Leur vérification finale repose sur l'audit SQL en lecture seule et la revue des cas négatifs existants.

## Lancement

Après configuration des variables par le responsable de l'environnement de test :

```sh
npm run smoke:real-permissions
```

Codes de sortie : `0` = scénarios présents réussis ; `1` = échec ; `2` = recette incomplète ou preuve d'isolation absente. La sortie ne contient que les alias de test, le nombre de lignes et les résultats — jamais d'identifiants, e-mails, mots de passe, secrets TOTP ou jetons.

Les parcours de création de compte, e-mail de confirmation et récupération du mot de passe doivent aussi être vérifiés manuellement dans une version de test du site avec une boîte mail de test autorisée. Ils ne sont pas déclenchés par le script : l'inscription créerait un compte et la récupération enverrait un e-mail.

## Références

- Cahier des charges : `docs/CAHIER_DES_CHARGES.md`, sections 2 à 6.
- Recette des espaces Joueur/Entraîneur : `docs/P1_ESPACES_SPORTIFS_RECETTE.md`.
- Authentification : `docs/ETAPE_3_AUTH.md`.
- Supabase Auth MFA : https://supabase.com/docs/guides/auth/auth-mfa
