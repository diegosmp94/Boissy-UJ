# Correctif de recette Chromium — rendu de route réellement stabilisé

**24 octobre 2026 — Outillage CI uniquement ; aucun code fonctionnel du site modifié.**

## Incident observé

Après la fusion de la PR #98 (`0d5f81b15396`), le workflow GitHub Pages a échoué lors de `npm run smoke:browser` sur `mobile-admin-guest` avec `Missing main content`. Le journal confirme pourtant **627/627 tests Node réussis**, l'export contrôlé et l'audit de confidentialité exécutés avec succès. Le workflow de la PR #98 était déjà vert ; l'échec est intermittent et correspond à un point faible du mécanisme de synchronisation du test navigateur.

L'ancienne fonction `ready` concluait après un seul échantillon de `document.querySelector('main')`, en se basant sur l'URL et sur la présence instantanée de texte. Cela ne garantissait pas que le routeur SPA avait stabilisé `#main` au moment des assertions suivantes.

## Correction

- Lectures successives **du même élément `#main`** que le contrôle final, avec un seul conteneur, route attendue et contenu substantiel.
- **Trois échantillons consécutifs** obligatoires à 125 ms d'intervalle ; tout état incomplet ou erreur remet le compteur à zéro.
- Fenêtre maximale 20 secondes, supérieure au délai réseau normal de 12 secondes des parcours publics et des sessions, sans supprimer ni masquer un échec si le contenu reste introuvable.
- Prédicat pur `scripts/browser-smoke-readiness.mjs` et tests négatifs contre page vide, route incorrecte, doublons, chargement en cours et durée insuffisante.
- Aucun compte ni privilège créé ; aucun ajustement des contrôles d'accès, de la CSP, du contenu RGPD ou des paiements.

## Recette attendue

Valider les workflows Tests, Vérifications et Publier sur `main`. Le job de publication doit terminer sa vérification HTTP du **commit exact** et conserver les contrôles du compte invité, de l'accessibilité et des parcours mobiles. Tant que cette vérification n'est pas verte, la PR #98 est seulement fusionnée dans le dépôt : elle n'est **pas** une mise en ligne confirmée.
