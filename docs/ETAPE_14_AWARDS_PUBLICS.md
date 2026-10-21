# Étape 14 — Awards Boissy-UJ (catalogue public)

## Ce lot développe le site sans réouvrir l'authentification, le MFA ou les paiements

### Expérience publique
- Nouvelle route `#/awards` avec design bleu nuit, bleu royal et doré.
- Accès direct depuis la page Communauté, le menu mobile et l'accueil.
- Catégories réellement publiées pour **Seniors A, B et C** uniquement : sélection par équipe, période d'édition et recherche sans accents.
- Cartes d'édition : catégorie, description, saison si renseignée, période de vote si officiellement annoncée.
- Nominations visibles **uniquement après autorisation de publication explicitement vérifiée** et publication par le club.
- Gagnants visibles uniquement après clôture, statut `finished`, annonce publique du résultat et nomination elle-même autorisée.
- Si aucune donnée n'est publiée, écran vide explicite sans catégorie, joueur, nomination, score ou gagnant inventé.
- Aucun bouton de vote, aucun achat, aucune réservation et aucune collecte de données personnelles.

### Modèle Supabase
Migration : `supabase/migrations/202610210014_public_awards_catalog.sql`
- `public.club_awards` : catégories, équipe A/B/C, titre, éventuelle saison, dates de vote, statut, publication.
- `public.club_award_nominees` : libellé, ordre, booléens de consentement et publication ; aucune photo, adresse, naissance ou contact stocké.
- `public.club_award_results` : au plus une proclamation officielle par catégorie, liée à un nominé **de la même catégorie**.
- RLS activée sur les trois tables ; droits clients **SELECT seulement**, avec visibilité des catégories publiées, des seuls nominés autorisés et des résultats annoncés.
- Pas de données d'exemple créées. Le site utilise des requêtes REST publiques avec la clé publishable uniquement.
- Les droits de publication seront développés dans un lot futur, après validation des comptes, de l'authentification, des rôles et des consentements. Aucun accès à ces écritures par les visiteurs.

### Vérifications et mises en garde
- Le statut `open` indique une période déclarée dans le catalogue ; **il ne donne pas accès à un vote** en préversion.
- Les données d'identification des joueurs (y compris mineurs) ne peuvent être diffusées sans base juridique appropriée, autorisation de diffusion vérifiée et procédure d'effacement. Si nécessaire, utiliser des libellés non nominatifs.
- Ne pas annoncer de prix, dates, catégories ou résultats FFF qui n'auraient pas été approuvés par le club.
- Le module doit être testé sur iPhone, Android et bureau lors de la recette globale ; la CI vérifie la logique, la confidentialité, les routes et la structure responsive.
- L'authentification publique reste désactivée, aucun vote Premium ni Stripe LIVE n'est activé.

## Déploiement Supabase vérifié — 21 octobre 2026

- Migration **`boissy_uj_public_awards_catalog_20261021` appliquée** au projet Boissy-UJ.
- RLS activée sur `club_awards`, `club_award_nominees` et `club_award_results`.
- Les clients `anon` et `authenticated` disposent de SELECT contrôlés uniquement, sans INSERT/UPDATE/DELETE sur le catalogue.
- Vérification transactionnelle sous rôle `anon` réussie : accès en lecture et impossibilité de modifier les enregistrements.
- **Zéro catégorie, zéro nominé, zéro résultat** en base au moment du contrôle. Aucun contenu fictif publié.
- L'audit global Supabase conserve certains avertissements déjà documentés sur des fonctions SECURITY DEFINER réservées aux comptes authentifiés ; ils ne proviennent pas des Awards, qui n'ajoutent aucune fonction RPC.

## Étapes suivantes hors périmètre
- Interface d'édition sécurisée par coach/équipe ou administrateur MFA AAL2.
- Workflow de nomination et de consentement, suivi des publications et révocations.
- Vote réservé aux membres éligibles Premium après authentification, anti-double vote, audit, clôture et publication des résultats.
- Annonces officielles des catégories et candidats par le club.
