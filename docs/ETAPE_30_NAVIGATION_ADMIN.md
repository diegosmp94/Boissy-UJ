# Étape 30 — Navigation rapide du panneau administrateur

## Fonctionnalités
Le panneau réel `#/control-center` dispose d'une navigation structurée en trois familles :
- **Pilotage** : vue générale, membres / rôles, demandes en attente ;
- **Sport** : effectifs publics, saisons, matchs et résultats, événements gratuits ;
- **Contenu** : actualités et identité du club.

Une barre de recherche filtre les modules par nom, description ou famille sans tenir compte des accents ni de la casse (par exemple « actualites », « matchs » ou « pilotage »). Les groupes ne montrent que les modules disponibles. Un message indique le nombre de modules trouvés et l'absence de résultats.

La vue générale propose des **accès rapides** aux membres, matchs, actualités et événements gratuits lorsqu'ils sont utilisables. Tous les boutons empruntent l'unique transition `selectSection`, qui contrôle à nouveau l'identité, le rôle serveur et le niveau MFA AAL2 avant d'accéder aux données.

Sur ordinateur, menu latéral classé par familles ; sur tablette, groupes en colonnes ; sur téléphone, navigation de hauteur contrôlée et déroulante pour éviter de repousser le formulaire sous une longue liste. Contrastes et navigation clavier conservés.

## Conformité et sécurité
- Aucune fonctionnalité de démonstration, aucune fausse statistique.
- Aucune écriture de données lors de cette étape.
- La présence du module événements dépend toujours de la lecture autorisée de `admin_list_free_events`. Si le backend est indisponible ou refuse l'accès, ce module n'est pas proposé.
- Les autres rubriques continuent à fonctionner, même si l'outil des événements est temporairement indisponible.
- Aucune modification des rôles, migrations ou permissions Supabase.
- Les tests de publication complète restent reportés conformément au choix du responsable du site.

## Contrôles
Six nouveaux tests unitaires (recherche, regroupement, disponibilité, navigation MFA, raccourcis, mobile), suite historique GitHub Actions complète et contrôle de la branche fusionnée.

## Limites
Une vérification visuelle en navigateur PC/iPhone demeure nécessaire pour homologuer précisément le rendu graphique. Les tests GitHub contrôlent le code et les invariants, pas un parcours utilisateur réel sur le site déployé.
