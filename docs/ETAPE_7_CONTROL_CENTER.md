# Étape 7 — Boissy-UJ Control Center

> **Exigence V1.1 :** un compte peut être joueur et entraîneur, entraîneur et administrateur, joueur et administrateur, ou les trois simultanément. Chaque ajout de rôle est validé par **un autre administrateur MFA AAL2** et journalisé. Prévoir gestion séparée des rôles, des équipes éducateur et de leur révocation ; la prévisualisation n'attribue jamais de rôle. Voir [cahier des charges](CAHIER_DES_CHARGES.md).
>
> Les anciennes mentions de migrations non appliquées ci-dessous sont historiques : voir [État Supabase actuel](ETAT_SUPABASE_20261021.md).

**Statut actuel :** le Control Center est une route réelle protégée par identité Supabase vérifiée, rôle administrateur et MFA AAL2. Les écrans ne sont activés que si leur RPC serveur est disponible. Les détails des modules opérationnels sont tenus à jour dans [l'étape 27 — back-office réel](ETAPE_27_ADMINISTRATION_REELLE.md), puis dans les étapes fonctionnelles plus récentes. La prévisualisation restante n'attribue jamais de rôle et n'écrit aucune donnée.

## Capacités développées
- Connexion standard dans Mon espace ; les outils administratifs restent séparés et exigent AAL2.
- Lecture et certaines modifications administratives passent par des RPC serveur auditées, avec contrôles de portée et confirmation : rôles, saisons, matchs, publications textuelles, fiches du club, personnes publiques, classements et événements gratuits.
- Les espaces joueur et entraîneur disposent de fonctions privées pour les convocations et affectations, décrites aux étapes 31 à 34.
- Les paiements, réservations payantes, gestion directe des comptes Auth et éditeur général de la page d'accueil ne sont pas activés.
- Les modules restent masqués lorsque leur migration ou leur RPC n'est pas disponible. Les tests automatisés vérifient les gardes, mais ne remplacent pas une recette avec des comptes autorisés.

## Niveaux d'accès appliqués au panel
1. Administrateurs : droits identiques, compte authentifié et MFA **AAL2**, vérifié **par la base et le serveur**, pas uniquement par un bouton front-end.
2. Éducateurs : seulement leurs équipes autorisées, avec droits de gestion et publication directe des contenus sportifs permis ; audit obligatoire.
3. Joueurs : leurs propres données privées, convocations et statistiques autorisées.
4. Supporters : données publiques et droits Premium après vérification serveur des paiements. Premium **n'est pas un rôle assigné depuis le navigateur**.
5. Public : pages publiques exclusivement, aucune visibilité sur contenus Premium, coordonnées ou inscriptions.
6. Aucun endpoint d'administration ne doit faire confiance aux données envoyées par le client pour l'identité, les permissions ou la facturation.

## Portes encore ouvertes
- Recette navigateur avec plusieurs comptes expressément autorisés : supporter, joueur, coach d'équipes distinctes, admin AAL1/AAL2 et cumul de rôles.
- Vérifier en direct la disponibilité des RPC requises avant d'utiliser chaque outil, puis contrôler les workflows d'e-mail et de MFA.
- Tester les procédures de sauvegarde/restauration dans une base isolée.
- Faire valider les informations juridiques, la confidentialité, les consentements et les publications de mineurs par les responsables du club.
- Terminer les modules finance, billetterie et gestion globale du site seulement après les validations juridiques et techniques requises.

## État de la recette
**Aucun point de recette fonctionnelle de production attribué automatiquement** sur la seule base d'une prévisualisation. La progression pondérée à 85 % doit mesurer des critères réellement testés et audités.

## Prochaine étape de la roadmap
Clore les preuves de recette ci-dessus avant d'activer de nouveaux parcours privés ou financiers. La checklist détaillée est dans [P1 — Espaces Joueur / Entraîneur](P1_ESPACES_SPORTIFS_RECETTE.md) et [P1 — Identité, RGPD et déploiement](P1_IDENTITE_RGPD_DEPLOIEMENT.md). Aucune note pondérée ni homologation n'est attribuée par la seule présence de code ou de tests automatisés.
