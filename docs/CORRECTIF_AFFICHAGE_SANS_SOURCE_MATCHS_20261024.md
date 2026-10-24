# Présentation des matchs sans nom de fournisseur — 24 octobre 2026

## Périmètre demandé

Retirer de l'interface publique les répétitions de « Source : ... », « Source du relevé » et des noms de fournisseurs sur les cartes de matchs. Conserver les scores, dates, adversaires, onglets Championnat/Coupe et liens **internes** Boissy UJ.

## Réalisé

- Match Center : cartes officielles simplifiées, bloc d'archives renommé « Archives des matchs et résultats », score lisible et message « à confirmer par le club ».
- Pages des cinq équipes : archives sans citation répétée par match, filtres par saison inchangés, indicateur de validation maintenu.
- Agenda : cartes nettoyées, score directement visible sans nom de fournisseur ; l'export calendrier reste limité aux publications du club.
- Calendrier mensuel : libellés de rencontres plus lisibles, avec couleur dorée pour les informations restant à confirmer ; données de date et résultat conservées.
- Classements et historiques : suppression des mentions de fournisseur dans la présentation ; bilan incomplet non présenté comme rang officiel.

## Séparation métier essentielle

La suppression **visuelle** ne constitue pas une homologation des rencontres : toutes les données historiques qui ne viennent pas d'une publication approuvée par le club restent marquées « à confirmer ». Les noms et URL des documents d'origine ne sont **pas supprimés** des fichiers historiques, de leurs métadonnées ni des archives SQL, afin de permettre les audits, corrections et contrôles du club.

**Point juridique à valider :** les droits de réutilisation de chaque fournisseur restent inconnus ; certains peuvent exiger une attribution visible ou interdire la reprise. Si une attribution publique est contractuellement obligatoire, le club devra l'afficher conformément à cette licence ou **ne pas republier ces relevés**. Le changement d'interface ne vaut pas permission de reproduire des données tierces.

Aucune donnée, rôle, autorisation, mot de passe, MFA ni paiement n'est modifié en production.

## Recette

Tests automatisés : noms de fournisseurs absents des composants d'affichage public, provenance encore conservée dans les archives, scores et liens d'équipe préservés, conformité des vues mobiles Chromium. Contrôle GitHub Pages du commit exact obligatoire après fusion.
