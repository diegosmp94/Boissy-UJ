# Étape 53 — Finition du front-end public

**Date : 23 octobre 2026 · Périmètre : front-end public.** Cette livraison ne crée aucune fonction de paiement, réservation ou vote sur le serveur, et ne modifie pas le projet Supabase.

## Livré

- **Communauté/Premium** : refonte responsive (320 px, tablette et bureau), comparateur Supporter gratuit / Premium à période mensuelle ou annuelle. Les boutons *Mensuel* et *12 mois* modifient réellement les prix et clauses affichés avec \`aria-pressed\`. Prix conformes au cahier des charges : **10 €/mois**, sans engagement, **100 €/12 mois**, sans renouvellement automatique. Aucun bouton Checkout ou formulaire de transaction.
- **Parcours supporters** : étapes explicatives, navigation vers Mon espace/Match Center/Awards, FAQ native avec \`details\` et\`summary\`, renvois clairs vers les événements.
- **Événements/Billetterie** : nouvelle mise en page de la rubrique et de l'accompagnement visiteur ; la liste dynamique déjà en place reste connectée au catalogue public. Aucune réservation, capacité, place ou prix fictif.
- **Soutenir** : présentation structurée des fonds généraux et campagnes futures, obligations de transparence et alternatives non financières. Aucun montant collecté ou projet inventé.
- **Awards sur mobile** : lien direct ajouté au menu mobile ; le catalogue et les règles de publication/consentement existants restent inchangés.
- **Cohérence** : rectification d'une mention publique obsolète de « quatre collectifs » vers les cinq équipes effectivement suivies.
- **Accessibilité** : bascule de période avec boutons natifs, états \`aria-pressed\`, régions nommées, accordéons natifs et états de service non ambigus. Les boutons non opérationnels de paiement/vote ne sont pas créés.
- **Responsive** : nouveau fichier \`premium-front.css\`, grilles 1 colonne sur mobile, 2 sur tablette, 3 pour le parcours sur bureau, contrôle du débordement horizontal.

## Tests

- Tests Node supplémentaires couvrant les prix et termes, la cohérence des bénéfices annoncés, l'absence de paiement activé, le lien Awards mobile, les classes responsive.
- Browser smoke élargi **de 10 à 16 scénarios** : smartphone 320/390, tablette 768, bureau 1366 sur les pages historiques et les nouvelles pages Communauté, Awards, Événements et Soutenir.
- Test navigateur interactif : prix 10 € mensuel → sélection 100 € annuel → retour mensuel ; états \`aria-pressed\` et absence de liens de paiement non autorisés.
- Les captures et le rapport Chromium restent stockés en artefacts de CI, sans compte client ni données personnelles.

## Ce qui ne peut pas être marqué « 100 % en production »

Les pages et le parcours publics peuvent être déclarés **développés côté interface**, mais le site global dépend toujours de :
- Tests réels de navigation assistive, VoiceOver iPhone, TalkBack Android et vérification visuelle sur appareils physiques.
- Paiements Stripe TEST, billetterie, Awards, donations et droits Premium avec vrais contrôles serveur, après habilitation.
- Mentions légales, RGPD, droits à l'image, contrats et autorisations du club.
- Contenus officiels (matchs/articles/photos) et leur publication par les responsables.
- Recette des comptes/rôles en staging et sauvegarde/restauration isolée.

**Ce lot clôt le travail de présentation publique identifié, pas l'homologation complète de toutes les interfaces ni le back-end.** Les éléments encore dépendants d'un service ne sont pas déguisés en fonctions disponibles.
