# Étape 50 — État de mise en service et recette P1

## Livré dans l'application

Le Control Center dispose du module **État de mise en service**, accessible après vérification du compte administrateur et de son MFA AAL2. Le module relance au besoin neuf contrôles **en lecture seule** qui n'affichent aucune ligne individuelle : catalogue des cinq équipes, liste de rencontres protégée, affectation des entraîneurs, événements gratuits, demandes de rôles, rédaction des articles, réactions, médias, et contrôle serveur des fichiers Storage.

Chaque ligne précise « Accessible » seulement si l'appel retourne la structure attendue ; sinon, « Non confirmé ». Un échec réseau, une erreur de permission, une absence de migration ou un défaut de contenu ne sont **jamais interprétés comme un succès**. La vue ne peut pas trancher la cause de l'échec sans investigations complémentaires.

Le tableau récapitulatif **X/9** désigne uniquement le nombre de lectures techniques répondant pour **ce compte administrateur**. Ce n'est ni un pourcentage d'avancement du site, ni une vérification croisée RLS, ni le score de la matrice pondérée sur 100. Les vérifications restent inaccessibles avant MFA AAL2 ; aucun accès service-role ou secret d'administration n'est transmis au navigateur.

## Audit SQL réel non destructif — 23/10/2026

Le script `scripts/db-readiness-audit.sql` a été exécuté contre le projet Supabase de Boissy-UJ en lecture seule. Observations :

| Vérification SQL | Constat |
|---|---|
| Tables `public` sans RLS | 0 |
| Fonctions `SECURITY DEFINER` exposées à `anon` | 0 |
| Contrôle administrateur AAL2 référencé par la fonction centrale | Oui |
| Équipes enregistrées | 5 |
| Rencontres dans `public.matches` | 0 |
| Articles dans `public.news_posts` | 0 |
| Fonctions d'administration coach et événements gratuits | Présentes |
| Table des réactions `news_reactions` | Absente |
| Table des médias `news_media_assets` | Absente |
| Vérification serveur du fichier média et RPC admin associée | Absentes |
| Bucket média approuvé | Absent |

**Ce diagnostic ne vérifie pas la qualité des politiques RLS, l'autorisation de chaque RPC, ni l'existence de sauvegardes.** Le linter Supabase peut signaler des RPC `SECURITY DEFINER` accessibles aux utilisateurs authentifiés : cet accès peut être intentionnel si elles revérifient le rôle et le MFA *côté serveur* ; il faut néanmoins auditer chaque fonction, et ne jamais assimiler une absence d'accès `anon` à un audit complet.

## Recette manuelle bloquante

1. **Comptes** : tester en staging avec des comptes de test autorisés supporter, joueur, entraîneur de deux équipes différentes, administrateur AAL1 puis AAL2, ainsi que les cumuls approuvés. Vérifier le refus des accès transverses, les cas de révocation et les modifications de rôle par un autre administrateur.
2. **Confidentialité** : valider par l'association les coordonnées, droits à l'image et autorisations des mineurs, durée de conservation, retrait et obligations RGPD avant tout média réel.
3. **Restauration** : réaliser une sauvegarde et une restauration isolée sur une base de test, comparer tables/index/contraintes/RLS, sans afficher ni stocker les données personnelles dans GitHub.
4. **Appareils réels** : Safari iPhone, Android Chrome, navigation au clavier, lecture d'écran, parcours MFA et écrans administratifs.
5. **Fonctions non homologuées** : laisser les migrations de réactions et de médias non appliquées jusqu'aux autorisations et essais concluants. Ne pas activer Stripe LIVE, l'automatisation FFF ou la billetterie payante sans accords et validations supplémentaires.

## Rejouer les contrôles

Le script SQL n'effectue que des SELECT et ne retourne que des indicateurs de schéma et des volumes agrégés non personnels. Le module de l'application relance ses propres vérifications **depuis la session administrateur connectée**, afin de distinguer la disponibilité générale du schéma de la disponibilité effective pour son rôle. Les deux contrôles sont complémentaires, jamais équivalents à une homologation globale.
