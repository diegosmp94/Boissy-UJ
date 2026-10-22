# Homologation P1 — phase 2 : accessibilité, autorisations et preuve (22 octobre 2026)

**Décision actuelle : NON HOMOLOGUÉ pour une ouverture générale.** Le code en préproduction et la réussite de la CI ne remplacent pas la recette fonctionnelle, juridique et humaine.

## Modifications de cette phase

1. Correction du lien d'évitement « Aller au contenu principal » : le routeur GitHub Pages utilise des fragments `#/...` et le lien traditionnel `#main` pouvait quitter la page. Le clic conserve maintenant la route, déplace le focus clavier sur `main` et facilite la navigation assistée.
2. Recette Chromium : le test vérifie maintenant aussi la page publique « Mon espace », le lien de confidentialité, le lien d'évitement réel, la présence de landmarks, le nom des commandes visibles d'en-tête et la préférence « animations réduites ». Les captures sont conservées dans les artefacts CI. **Il ne couvre ni VoiceOver réel, ni TalkBack, ni tous les critères WCAG.**
3. Inventaire réseau anonyme : les origines HTTP(S) contactées par le navigateur sont listées dans `browser-network-origins.json`, sans URL complète, cookies, en-têtes, tokens ni données personnelles. Le test est limité à la préversion locale, sans ouverture d'un vrai compte.
4. Audit sécurité SQL en **lecture seule** `scripts/db-security-audit.sql` pour surveiller RLS sur toutes les tables publiques, les privilèges RPC accessibles à `anon` et la présence des contrôles `auth.uid()` / `app_private.is_admin()` dans le code SQL. Ces tests structurels ne prouvent pas à eux seuls l'absence de faille logique.

## État constaté directement sur Supabase au début de cette phase

- 18 tables métier `public` avec RLS activée ; aucune n'est dépourvue de RLS.
- 25 RPC `SECURITY DEFINER` accessibles aux comptes authentifiés, **0** accessible au rôle anonyme. Les 25 contiennent un contrôle `auth.uid()` ; les RPC administrateur recensées utilisent le garde central `app_private.is_admin()`.
- Le garde `app_private.is_admin()` exige **simultanément** le rôle administrateur et un JWT MFA **AAL2**.
- Supabase Security Advisor affiche toutefois 25 avertissements `authenticated_security_definer_function_executable`. Cette exposition est voulue pour les RPC front-end seulement si leur autorisation côté serveur résiste à tous les scénarios. **La validation multi-identités reste requise**, sans supprimer ces alertes artificiellement par une régression fonctionnelle.
- L'option de blocage des mots de passe connus comme compromis n'est pas activée ; elle dépend du niveau d'offre Supabase compatible et de la configuration Auth par un responsable habilité. Ne pas annoncer sa disponibilité sans vérification.
- Les 13 avertissements `rls_enabled_no_policy` concernent des tables d'audit/sport privées et des tables non lisibles par défaut. L'absence de politique dans ces tables n'implique pas qu'il faille ajouter une politique permissive.

## Scénarios d'acceptation indispensables

| Contrôle | Preuve attendue | Statut |
| --- | --- | --- |
| Tests unitaires, audit de bundle et captures Chromium | CI verte sur PR puis `main` | À confirmer après fusion |
| Navigation mobile, skip link, compte non connecté et mode sans animations | Fichiers JSON + captures dans CI | À confirmer après CI |
| Rôle joueur, entraîneur, administrateur, doubles et triple rôles | Séances avec plusieurs comptes **habilités** et administrateurs distincts, MFA AAL2 ; vérifier refus hors droits | **À faire sur comptes autorisés** |
| Vérification d'authentification (inscription, e-mail, récupération, sessions) | Tests réels de bout en bout sans fuite de données | **À faire** |
| Autorisations réseau et cookies effectifs | Inspection sur la version publiée dans différents navigateurs, avant et après consentement applicable | **À faire** |
| iPhone Safari + VoiceOver, Android Chrome + TalkBack, tablette et bureau | Procès-verbal de navigation, contrastes, champs, clavier et écran d'accès | **À faire sur appareils** |
| Sauvegarde ET restauration d'un export Supabase | Base isolée sans altération de production, checksum ou contrôles d'intégrité, procès-verbal | **À faire** |
| Information légale du club, hébergement, droits des sportifs, conservation des données et sous-traitants | Mentions validées par représentant habilité du club | **À faire** |
| Mise à jour Auth « leaked password protection » | Option effective si l'offre le permet, sinon risque documenté | **À décider** |
| Déblocage SEO | Décision expresse après conformité et recette complète | **Non autorisé** |

## Protocole pour la recette multi-identités

Sur des comptes consentants et autorisés par le club, procéder par permutations **sans créer de personnes fictives en production** : supporter seul, joueur, entraîneur affecté à une équipe, entraîneur non affecté, administrateur AAL1, administrateur AAL2, joueur+entraîneur, joueur+administrateur et triple rôle. Comparer les réponses et écritures autorisées de chaque espace. Contrôler l'absence d'auto-validation de rôle, l'absence de fuite entre équipes et l'isolement des convocations. Réaliser un refus/approbation avec **deux administrateurs distincts** et conserver des preuves anonymisées.

La lecture du SQL seule et les tests locaux ne prouvent pas les permissions sous vrais JWT. **Ne pas annoncer la conformité avant cet essai.**

## Références

- Supabase, RPC `SECURITY DEFINER` : https://supabase.com/docs/guides/observability/advisors?lint=0029_authenticated_security_definer_function_executable
- Supabase, protection des mots de passe : https://supabase.com/docs/guides/auth/password-security
- CNIL, protection des données dans le sport amateur : https://cnil.fr/fr/sport-amateur-hors-contrat/questions-reponses
- Checklist P1 préexistante : [Identité, RGPD et déploiement](P1_IDENTITE_RGPD_DEPLOIEMENT.md)
