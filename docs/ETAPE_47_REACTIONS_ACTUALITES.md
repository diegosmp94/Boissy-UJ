# Étape 47 — Réactions aux actualités publiques

**Périmètre :** permettre aux comptes connectés d'aimer ou de retirer leur réaction à une actualité publique du Media Center. Les visiteurs non connectés conservent l'accès aux articles et disposent d'un lien **interne** vers Mon espace. Pas de commentaires, messagerie ou notation des personnes.

## Protection des comptes

- Table nouvelle \`public.news_reactions\` : une réaction par couple publication/compte ; suppression volontaire, suppression en cascade lorsque l'article ou le compte est effacé.
- **RLS obligatoire** et droits SQL restreints à \`SELECT\` de sa propre ligne, \`INSERT\` pour soi sur un article effectivement publié/public avec droits vérifiés, \`DELETE\` de sa propre ligne. Pas d'\`UPDATE\`, aucune lecture anonyme des identifiants des autres membres.
- Aucune identité de membre, aucun nombre de réactions par personne et aucune information privée affichés publiquement ; la liste de ses propres réactions est récupérée après authentification.
- Bouton accessible, état \`aria-pressed\`, message de résultat, protection des doubles clics et erreur sans dévoiler d'information de base.
- Si la migration n'est pas appliquée ou que le service Auth est indisponible, le Media Center reste entièrement **en lecture seule**. Ne pas simuler une réaction réussie.

## Mise en service / contrôle

1. Tests GitHub et revue de \`supabase/migrations/202610230001_member_news_reactions.sql\`.
2. Valider avec le club l'information RGPD sur cette donnée personnelle volontaire et sa conservation, notamment pour les comptes mineurs.
3. Appliquer la migration puis vérifier RLS et les droits \`SELECT\`/\`INSERT\`/\`DELETE\` sur une base **de test** avec deux comptes distincts avant toute ouverture.
4. Vérifier depuis le site : visiteur non connecté, réaction d'un membre, suppression par lui-même, refus d'insertion sur publication cachée, impossibilité de lire/modifier la réaction d'autrui.

**État :** code et migration livrables après CI ; migration non appliquée automatiquement en production et recette multi-comptes toujours requise. Les fonctions de paiement, média photo, votes et billetterie ne sont pas affectées.
