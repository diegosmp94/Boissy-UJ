# Boissy-UJ — Plan du lot 2 : fondations sécurisées

**Statut : préparation, non déployé.** Le lot 1 couvre uniquement le site public de prévisualisation. La matrice sur 100 points et les conditions bloquantes sont définies dans [MATRICE_RECETTE.md](MATRICE_RECETTE.md).

## Ordre de réalisation

1. **Supabase Auth** : comptes supporters, connexion, inscription et réinitialisation par e-mail ; aucun mot de passe conservé par le site.
2. **Profils et rôles cumulables** : supporter, premium, licencié, éducateur et administrateur. Les administrateurs disposent de droits égaux. Invitations pour les éducateurs et les administrateurs.
3. **Autorisation côté serveur** : politiques RLS, contrôle des droits des éducateurs par équipe, stockage privé des données sensibles et journaux d'audit.
4. **Sports Manager** : saisons et quatre équipes, fiches joueurs sous consentement, convocations, compositions, statistiques et saisie manuelle des résultats.
5. **Media Center** : publications directes des éducateurs pour leurs équipes autorisées, réactions uniquement, interdiction des commentaires, gestion des médias et droits à l'image.
6. **FFF** : recherche d'une intégration autorisée ; aucune extraction de site myFFF ou du District sans vérification. Fonctionnement manuel obligatoire en secours.
7. **Stripe TEST seulement** : premium mensuel 10 € renouvelable et résiliable ; annuel 100 € non renouvelé automatiquement ; dons ponctuels/mensuels, campagnes et billets. Les droits premium ne sont attribués qu'à partir de confirmations de paiement vérifiées par le serveur.
8. **Billetterie et Control Center** : réservations, jauges, privilèges premium, brouillons, programmation, historique des versions, restaurations et rapports.

## Protections obligatoires

- Refuser l'accès par défaut et tester chaque rôle et combinaison de rôles ; ne jamais placer la clé service_role dans le navigateur.
- Conserver les données des mineurs et les informations de convocation hors des zones publiques ; autorisations d'image avant diffusion.
- Pas de collecte de données personnelles via une interface « démo ».
- Aucune clé secrète, accès de production, compte bancaire ou paiement LIVE dans le dépôt.
- Journaliser toute opération sensible ; protéger les webhooks et dédupliquer les notifications.
- Aucun score officiel FFF inventé ou importé sans droit.

## Portes de sortie

Chaque lot est revu via une branche et une pull request. Les tests s'exécutent pendant le développement ; la **recette finale commence à 85/100 points effectivement vérifiés** et non à 85 % de simples pages présentées. Déploiement et activation des paiements restent des décisions séparées.
