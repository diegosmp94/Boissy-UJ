# Étape 7 — Boissy-UJ Control Center

> **Exigence V1.1 :** un compte peut être joueur et entraîneur, entraîneur et administrateur, joueur et administrateur, ou les trois simultanément. Chaque ajout de rôle est validé par **un autre administrateur MFA AAL2** et journalisé. Prévoir gestion séparée des rôles, des équipes éducateur et de leur révocation ; la prévisualisation n'attribue jamais de rôle. Voir [cahier des charges](CAHIER_DES_CHARGES.md).
>
> Les anciennes mentions de migrations non appliquées ci-dessous sont historiques : voir [État Supabase actuel](ETAT_SUPABASE_20261021.md).

**Version : aperçu de conception interactif, sans privilège administrateur et sans connexion réelle.**

## Développement effectué
- Route `#/control-center` accessible depuis `Mon espace`, avec une présentation premium bleu nuit / doré.
- Vue générale et navigation entre les **10 modules** : pilotage, comptes/rôles, sport, matchs, médias, Premium/Awards, événements, finance, éditeur de site, sécurité/intégrations.
- Recherche et filtre des modules par catégorie, navigation utilisable au clavier et mise en page mobile.
- Indicateurs **de conception uniquement** (quatre équipes configurées, nombre de modules, paiements LIVE non activés, absence d'accès admin).
- Aperçu interactif du gestionnaire des **8 chapitres d'accueil** : déplacer en haut/bas, masquer/réafficher, prévisualiser l'ordre, réinitialiser.
- Aucune donnée personnelle lue, aucun appel serveur, aucune création/suppression utilisateur, aucun paiement, aucune sauvegarde.
- Les actions de l'éditeur ne concernent que l'état en mémoire de l'onglet courant. Recharger quitte l'aperçu : **aucune modification du site publié**.
- Les liens vers des rubriques publiques sont opérationnels, quand une rubrique existe.

## Niveaux d'accès requis pour le futur panel RÉEL
1. Administrateurs : droits identiques, compte authentifié et MFA **AAL2**, vérifié **par la base et le serveur**, pas uniquement par un bouton front-end.
2. Éducateurs : seulement leurs équipes autorisées, avec droits de gestion et publication directe des contenus sportifs permis ; audit obligatoire.
3. Joueurs : leurs propres données privées, convocations et statistiques autorisées.
4. Supporters : données publiques et droits Premium après vérification serveur des paiements. Premium **n'est pas un rôle assigné depuis le navigateur**.
5. Public : pages publiques exclusivement, aucune visibilité sur contenus Premium, coordonnées ou inscriptions.
6. Aucun endpoint d'administration ne doit faire confiance aux données envoyées par le client pour l'identité, les permissions ou la facturation.

## Dépendances et portes de sécurité
- **Supabase Auth désactivé sur le site public** : l'interface actuelle n'expose aucun accès administrateur réel.
- Les migrations sport, actualités et événements ont été rédigées mais **ne sont pas appliquées** : l'autorisation d'appliquer une migration Supabase n'a pas été accordée précédemment et aucune nouvelle tentative ne sera faite sans approbation.
- Pas d'éditeur publiant de vraies modifications avant création du backend, RLS, historique des versions, contrôles sur les rôles, gestion de la publication et prévisualisation mobile/desktop.
- Préparer les migrations pour les affectations éducateur-équipe, les brouillons CMS, les droits de publication et un journal d'audit inviolable par les utilisateurs ordinaires.
- Effectuer tests d'accès croisés avec deux comptes distincts, l'un supporteur et l'autre administrateur MFA ; scénarios d'usurpation et d'élévation de rôle.
- Prévoir limitation du nombre de requêtes, gestion des erreurs sans fuite de données, sauvegardes et tests de restauration.
- Finaliser textes juridiques, consentements et traitement des mineurs avant exposition de fonctions réelles.

## État de la recette
**Aucun point de recette fonctionnelle de production attribué automatiquement** sur la seule base d'une prévisualisation. La progression pondérée à 85 % doit mesurer des critères réellement testés et audités.

## Prochain lot proposé
- Construire une API côté serveur avec authentification, RLS et contrôles de portée, puis les vrais écrans de gestion des équipes et des actualités.
- Installer seulement les migrations approuvées sur Supabase.
- Raccorder les fonctions d'édition à un cycle brouillon → prévisualisation → publication autorisée → restauration.
