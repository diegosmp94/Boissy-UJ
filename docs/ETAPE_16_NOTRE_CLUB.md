# Étape 16 — Notre club
- Route publique `#/club` : quatre équipes déjà identifiées et accès aux autres rubriques.
- Histoire, valeurs, organisation et projets affichés seulement après publication par Boissy-UJ.
- Migration `202610210016_club_identity_public.sql` : table `club_identity_sections`, RLS, SELECT publié uniquement, aucune donnée créée.
- Recherche et filtre accessibles, interface mobile bleu nuit/doré, chargement annulable, DOM textContent.
- Aucune date de création, aucun dirigeant ni projet non confirmé n'est inventé.
- Authentification, écriture des contenus et paiements restent hors périmètre.
