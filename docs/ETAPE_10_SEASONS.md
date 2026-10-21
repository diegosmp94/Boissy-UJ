# Boissy-UJ — Étape 10 : gestion sécurisée des saisons

## Site — Control Center
- Rubrique Équipes : **liste des saisons réellement présentes dans Supabase** (lecture publique uniquement).
- Prévisualisation d'une nouvelle saison : intitulé AAAA/AAAA+1, statut (prévue, en cours, terminée), début et fin.
- Validation côté navigateur : deux années consécutives, ordre des dates, années cohérentes et statuts autorisés.
- Aucun bouton ne réalise d'enregistrement : la connexion publique n'est pas homologuée.

## Base Supabase

**Mise à jour vérifiée :** migration `boissy_uj_admin_season_management_20261021` appliquée sur Supabase, table `app_private.season_change_log` protégée par RLS, aucune saison créée. Le test transactionnel a confirmé qu'une session sans `auth.uid()` ne peut pas appeler la fonction ; les parcours avec de vraies identités et MFA restent à tester.

Migration : `supabase/migrations/202610210010_admin_season_management.sql`.
- RPC `admin_save_season` : exige `auth.uid()` et `app_private.is_admin()` (administrateur MFA AAL2).
- Aucun utilisateur / coach ordinaire ne peut créer ni modifier la saison.
- Une seule saison associative en état `active`, via index unique partiel.
- Interdit les saisons sans début/fin cohérents et les années non consécutives.
- Refuse de renommer une saison déjà liée à des rencontres.
- Audit privé `app_private.season_change_log` : versions avant/après chaque changement, pas de lecture ou d'écriture depuis un client public.
- Aucune saison ou rencontre fictive ajoutée.

## Conditions de mise en service des écritures
- Authentification et confirmation mail correctement configurées.
- Création d'un administrateur réel par une procédure d'amorçage validée, MFA AAL2.
- Vérification dynamique de la RPC avec vrais jetons de sessions de test (admin MFA, admin non MFA, supporter, coach).
- Historique et journalisation vérifiés sur des données de test temporaires isolées.
- Ne jamais exposer de clé service rôle dans GitHub Pages.
- Tests de navigateurs Safari/Android à faire lors de la recette commune.

Le fait d'appliquer la migration n'active pas les écritures depuis le Control Center public.
