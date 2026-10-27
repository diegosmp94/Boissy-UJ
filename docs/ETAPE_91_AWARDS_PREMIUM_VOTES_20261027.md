# Étape 91 — Awards et votes Premium réels, contrôlés et privés

**27 octobre 2026 — intégration du code Awards au catalogue existant et au Control Center.**

## Point de départ

Le Supabase principal possède déjà `public.club_awards`, `club_award_nominees` et `club_award_results` avec RLS, et affiche uniquement les dossiers publiés, les nominés avec consentement revu et les résultats effectivement publiés. Inventaire avant modification : **0 Award, 0 nominé, 0 résultat**, aucune table de bulletins ni RPC de vote. Le prototype historique `202610230003_premium_awards_ballots.sql` n'est **pas déployé** ; il employait un registre de facturation obsolète et ne doit pas être appliqué en complément.

## Migration

`supabase/migrations/202610270010_step91_awards_verified_voting.sql` :

- `app_private.awards_voting_gate` : verrou **OFF par défaut et forcé à OFF à l'installation**, RLS et aucune activation à distance (pas de RPC d'activation). Il faut une procédure d'homologation manuelle ultérieure pour le lever sur un **staging indépendant**.
- `app_private.award_ballots` : un bulletin par `(award_id,user_id)`, relation du candidat obligatoirement dans la même catégorie. La mise à jour d'un bulletin remplace son candidat **avant la clôture**, sans second vote ni divulgation de son choix aux autres. RLS et interdiction totale d'accès direct au navigateur.
- `app_private.admin_awards_audit` : actions administratives, identifiant opérateur, catégorie et transition ; aucune identité de votant, aucun secret de paiement ou QR.
- `admin_list_awards`, `admin_list_award_nominees` : lectures intégrales réservées aux administrateurs MFA AAL2 (brouillons compris), aucune fuite des dossiers inédits via les tables publiques.
- `admin_save_award` : création/modification avant ouverture avec version `updated_at` obligatoire pour une modification ; équipe Seniors A/B/C, titre, description, saison et dates, publication contrôlée. Un Award ouvert/clos/terminé ou ayant reçu des bulletins ne peut être modifié.
- `admin_save_award_nominee` : choix publié seulement si `consent_reviewed` confirmé, protection de version lors des corrections et interdiction de modifier les candidatures après démarrage des votes.
- `admin_transition_award` : transitions administrateur MFA, jamais déclenchées depuis un statut arbitraire fourni au client. Ouverture uniquement si verrou ON, catégorie publiée, horaires effectivement ouverts et au moins deux nominés approuvés. Clôture manuelle verrouillée. Publication uniquement après la fin de la période, sans résultat préexistant, et avec **un seul premier au dépouillement réel**, au moins un bulletin. Égalité ou absence de votes : aucune publication ni gagnant automatique.
- `member_cast_award_vote`, `member_my_award_vote`, `member_withdraw_award_vote`, `member_awards_voting_capability` : APIs restreintes aux comptes Auth confirmés ; vote ou modification nécessite aussi une attribution Premium active **vérifiée sur le serveur**, fenêtre valide et catégorie/candidat publiés avec consentement ; retrait possible uniquement **avant la clôture** pour préserver les résultats officiels. Aucune projection publique des nombres de votes, ni sélection d'un autre compte.

Le contrôle de facturation `app_private.member_has_active_premium()` réutilise les droits serveur existants (étape 82). Avant l'ouverture sur staging, la version renforcée par liaison à une Charge Stripe TEST attestée (étape 84) doit également être installée et auditée. **Aucun utilisateur ne reçoit de droit Premium dans cette migration.**

## Expérience utilisateur

- **Control Center : Awards et votes** — gestion de catégories/brouillons, saisie des nominés contrôlés, confirmation en deux clics des publications sensibles et transitions (ouvrir / clôturer / publier). Toute modification est exécutée par RPC administrateur MFA AAL2. Le module n’apparaît que si son API est réellement disponible. Les totaux privés et les identités de votants n’y sont pas exposés.
- **Mon espace : Mes votes Awards · Premium** — affichage des catégories publiées/actuellement ouvertes et des candidatures consenties, enregistrement, modification ou retrait du vote personnel. Si le serveur indique que les votes sont verrouillés ou Premium inactif, aucun bouton ne permet de voter.
- **Page publique Awards** — catalogue antérieur conservé. Les résultats restent invisibles tant que l'administration n'a pas clôturé, dépouillé et explicitement publié le gagnant.

## Sécurité et homologation

Les fichiers `tests/step91-awards-premium-workflow.test.mjs` contrôlent le schéma privé, les transitions, les versions optimistes, le dépouillement, l'accès Premium, l'absence d'identifiants votants dans l'interface et les gardes de navigation.

Tests de recette restant à effectuer **en staging distinct** : un compte non Premium, un Premium avec Charge attestée, un Premium révoqué, deux administrateurs MFA AAL2, deux vrais comptes votant simultanément, un changement de candidat, un retrait pendant la fenêtre, un vote après clôture, une égalité, zéro vote et une publication avec gagnant unique. Les demandes RGPD d'effacement **après clôture** doivent être traitées dans l'étape 92 avec suivi et procédure de correction du résultat, et non par un retrait silencieux.

**Aucune catégorie, nomination, voix ou personne fictive ne doit être ajoutée à la production.** L'application de la migration peut rendre la console de gestion utilisable, sans activer aucun vote tant que la certification n'est pas obtenue.
