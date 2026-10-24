# Simplification du trombinoscope joueurs — 24 octobre 2026

Le site Boissy UJ présente désormais les joueurs en grandes cartes verticales, à l'image d'un trombinoscope de club.

## Format demandé

**Portrait (tête et épaules) + numéro en surimpression sur le portrait + prénom et nom uniquement.**

- Une seule zone portrait avec cadrage vertical 4:5.
- Numéro de maillot en badge doré en bas à droite de l'emplacement photo.
- Le nom public **tel qu'approuvé** par le club juste sous le portrait, sans poste, âge, biographie ni statistiques dans la grille.
- La carte entière est un lien vers la fiche individuelle si elle possède un UUID public valide. La page détaillée conserve les informations supplémentaires dans leur espace propre.
- Responsive : 4 colonnes sur écran large, 3 sur tablette, 2 sur téléphone ; supports tactiles et navigation au clavier.
- Affichage dans les pages **Joueurs** de chaque équipe et dans le bloc Effectif de leur page de présentation ; l'encadrement conserve sa présentation distincte.

## Portraits non fournis

Le catalogue `team_public_people` ne contient actuellement **aucune photo ou URL de portrait**. La case portrait contient donc, pour le moment, **une silhouette neutre de tête et épaules**, qui n'est pas une photo d'une personne réelle ni un visage inventé.

Pour ajouter de vraies photos ultérieurement, le club devra approuver les droits à l'image (y compris autorisation du représentant légal lorsque nécessaire), un stockage sécurisé et un workflow de publication MFA. Ne pas utiliser une photo récupérée sur un réseau social ou une image tierce sans droits. Tant que les photos ne sont pas homologuées, il ne faut pas exposer d'URL de portrait non vérifiée.

## Données

Le nom et le numéro sont lus uniquement des lignes du club `published=true`, `consent_confirmed=true`, rattachées à l'équipe sélectionnée. Un numéro manquant est affiché « — », pas 0 ; les dates de naissance ne sont ni lues ni exposées.

## Contrôles

- Rendu DOM de la carte, lien UUID valide, absence de poste / bio dans les cartes, numéro en surimpression.
- Placeholder portrait neutre et accessible ; aucune URL tierce ni nom fictif dans les profils.
- Grille responsive et `prefers-reduced-motion`.
- Suite Node complète + parcours Chromium de la page `/equipes/football/seniors-a/joueurs`.
- Aucune écriture Supabase et aucun changement de rôles, d'authentification ou de résultats sportifs.
