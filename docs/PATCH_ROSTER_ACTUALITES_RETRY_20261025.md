# Correctifs ciblés effectifs, éducateurs et actualités — 25 octobre 2026

## Audit et anomalies reproduites

1. **Fausse liste vide pendant une panne Supabase.** Lorsque la lecture du catalogue `team_public_people` échouait, la page affichait simultanément l'avertissement d'indisponibilité et quatre rubriques vides plus Éducateurs, laissant croire que l'effectif était absent. **Patch :** ne pas construire de trombinoscope lors d'une erreur de lecture. Les statistiques et actualités publiques, lorsqu'elles sont accessibles séparément, continuent de s'afficher sur la fiche d'équipe. Aucun nom privé n'est ajouté.

2. **Éducateur bloqué après une session expirée.** L'accordéon de gestion des affiliations ne réessayait pas après un refus d'authentification : le drapeau interne restait positionné et aucun bouton n'était affiché. **Patch :** un bouton « Réessayer la vérification » permet de reprendre l'authentification à la demande. Aucun appel privé n'est fait avant l'ouverture volontaire ; chaque requête est à nouveau autorisée **par le backend**.

3. **Impossible de rafraîchir une équipe sans joueur affilié.** Le bouton de rechargement n'était inséré que dans un formulaire affiché lorsqu'au moins un joueur existait. **Patch :** « Actualiser les affiliations » est accessible après une liste correctement autorisée, même vide, et disparaît si la session perd ses droits. Il n'ouvre ni les inscriptions ni les rôles.

4. **Lien d'actualités obsolète.** Le lien de bas de fiche pointait encore vers l'ancien filtrage général des actualités. **Patch :** toutes les équipes renvoient vers leur véritable route `#/equipes/<discipline>/<slug>/actualites`.

5. **Boutons masqués rendus visibles par CSS.** Les boutons étaient des éléments `display:inline-flex`, règle pouvant primer sur `[hidden]`. **Patch :** `.team-affiliated-reload[hidden]{display:none!important}`.

## Sécurité et garanties

- Aucune modification des RPC de permissions, du schéma ou des données de production.
- Toute écriture demeure réservée à l'éducateur affecté à l'équipe ou à l'admin MFA, via une fonction Supabase qui vérifie les droits à chaque sauvegarde.
- Si la session expire en cours de navigation, la liste privée et son formulaire sont retirés de l'écran.
- Aucun portrait, nom, âge ou statistique personnelle inventé ; les contrôles de consentement et de publication sont maintenus.
- Le patch ne réconcilie toujours pas automatiquement les affiliations privées et le catalogue public : une publication explicite reste obligatoire.

## Vérifications

Le test `tests/team-roster-resilience-patch.test.mjs` reproduit : échec de connexion, bouton de nouvelle tentative, session reconnue sans joueur, ajout d'un joueur après rafraîchissement, puis expiration retirant les données privées. Il confirme également la destination des 5 sous-pages Actualités et le signalement des pannes du catalogue public.

Les recettes réelles avec plusieurs comptes éducateur/admin, appareils Safari/Android et des identités publiques autorisées restent à homologuer séparément. Les tests automatisés n'utilisent pas de compte de production.
