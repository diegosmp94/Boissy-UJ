# Étape 61 — Billetterie gratuite, QR et Awards (partie préparation sécurisée)

**24 octobre 2026.** Cette livraison traite l'expérience Awards et prépare le protocole de futurs billets gratuits **sans accepter de réservation, générer de vrais billets ou donner accès aux événements**. Aucun achat, paiement ou nouvelle collecte de données personnelles.

## Audit préalable et état de la production

Les tables `club_events`, `club_awards`, `club_award_nominees` et `club_award_results` existent déjà sur Supabase production. Une vérification de lecture seule a confirmé **0 événement public publié, 0 catégorie Awards publiée, 0 nomination publiée consentie et 0 résultat enregistré** à la date de l'audit.

Les scripts des étapes précédentes avaient préparé :
- le catalogue public des événements et l'administration des événements gratuits sous contrôle admin MFA ;
- le catalogue public Awards, les nominations soumises à publication et consentement, et les résultats contrôlés ;
- une migration **non déployée** pour le vote Premium privé unique et son retrait, plus une recette test nécessitant deux comptes staging et un droit Premium attesté.

Il n'existait **aucune** table de réservations, aucune émission effective de billets, aucun contrôle d'entrée QR atomique. N'inventons pas de « places restantes » et n'affichons aucun bouton « Réserver » effectif.

## Ce qui est codé

### 1. Awards publics résilients

`awards-center.mjs` donne priorité aux catégories réellement **publiées**. Les réponses des nominations et des résultats sont maintenant indépendantes, avec `Promise.allSettled`. Une panne d'une des sources facultatives **ne masque plus** les catégories disponibles ; elle provoque un message d'indisponibilité dédié.

- Aucune nomination n'est inventée en cas de panne.
- Aucun gagnant n'est affiché sans résultat réellement retourné, nomination publiquement visible et consentement revu.
- Le vote Premium reste non activé et le retrait de vote préparé ne modifie aucune donnée en production.

### 2. Préparation des événements gratuits dans le centre d'administration

Le module **« Préparation billetterie »** est accessible seulement si la lecture administrative des événements répond et si la session possède le rôle administrateur avec MFA AAL2. Il relit le RPC `admin_list_free_events`, n'affiche que les champs nécessaires du catalogue et indique, événement par événement :
- publication et catégorie gratuite/publique ;
- dates valides, événement futur ;
- jauge supérieure à zéro et connue ;
- statut déclaré `open`, **qui ne signifie pas pour autant que la billetterie fonctionne**.

Un événement avec des métadonnées prêtes est marqué « Préparation possible · aucun billet QR émis ». L'interface **ne crée pas** de réservation, ne collecte pas les données des spectateurs et n'accorde pas d'entrée.

### 3. Format opaque de billet QR proposé (serveur uniquement)

La bibliothèque `supabase/functions/_shared/free-ticket-qr-protocol.mjs` définit un identifiant **BUJ1:<event-uuid>:<secret-hex>**, avec un secret cryptographiquement aléatoire de 256 bits. Le code ne contient **ni nom, ni email, ni numéro de téléphone**.

Le serveur futur devra **stocker uniquement SHA-256(secret)** et jamais un QR brut. Le module permet le formatage, le contrôle strict, une comparaison de condensés sans révélation des octets et les libellés explicites pour billet utilisé/annulé/expiré.

**Attention : ce format n'est pas à lui seul un ticket valide ni une preuve d'entrée.** Aucun outil ne dessine actuellement de QR transmis à un vrai visiteur. Le contrôle doit être en ligne, côté serveur, avec un changement d'état atomique. Le code de protocole ne doit jamais être publié dans le bundle statique du site.

### 4. Préparation du modèle de réservation / anti-doublon — reste à implémenter en environnement isolé

Une migration et sa recette réelle doivent encore prévoir :

1. Table privée des réservations de **billets gratuits**, liée à `auth.uid()`, à l'événement et à un condensé du secret ; pas de PII dans le QR. Accès direct `anon` et `authenticated` révoqué, RLS et fonctions serveur strictes.
2. **Interrupteur désactivé par défaut**. Aucune création effective sans homologation et validation du club.
3. Émission d'un seul ticket actif par compte/événement, vérification d'un compte authentifié, d'un événement confirmé et d'une jauge réelle. Verrouiller la ligne de l'événement et recompter les billets valides **dans une transaction serveur** pour prévenir les sur-réservations concurrentes.
4. Annulation/expiration et libération de jauge documentées ; impossibilité de réactiver un ticket déjà scanné par modification côté navigateur.
5. Lecteur QR par un bénévole ou responsable habilité, avec contrôle serveur du hash et du bon événement puis transition atomique `issued → checked_in`, une seule fois. Refus des réutilisations et des QR d'un autre événement. **Jamais de validation hors ligne sur la seule apparence du QR**.
6. Éviter les journaux de tokens, prévoir rotation/révocation et procédure de perte de billet, et définir une durée de conservation minimale adaptée à la vie associative.
7. Tests au moins à **deux comptes** et **deux scanners** en concurrence, jusqu'à épuisement d'une petite jauge fictive, avec annulation, doublon, token falsifié, droit d'accès refusé et mobile Safari/Android. Aucun token ou compte de production ne doit être utilisé.

La billetterie **payante** et les paiements Premium ne font pas partie de cette fonction gratuite et restent bloqués.

## Tests réalisés

Le dépôt possède des tests Node qui vérifient le secret de 256 bits, le format strict et le refus de QR altérés, les hachages, le filtrage des métadonnées, la navigation admin MFA et le maintien des catégories Awards malgré une panne des résultats. Les parcours Chromium existants sont conservés.

**Statut réel :** préparation technique et interface administrateur terminées en code ; émission des billets, lecteur QR, jauges transactionnelles et vote Premium authentifié **non déployés et non homologués**. Les chantiers restent ouverts à ces titres, et aucune donnée de production n'a été écrite dans cette étape.
