# Étape 89 — Contrôle d'entrée QR sécurisé, mobile et traçable

**27 octobre 2026 · code livré pour préproduction isolée, aucune entrée réelle autorisée.**

## Fonctionnement du contrôle d'entrée

Le Control Center dispose du module **Contrôle entrée QR**, accessible exclusivement à l'administrateur habilité avec MFA **AAL2** dans une préproduction explicitement autorisée. Il est **absent de la navigation du site principal** car la fonction de capacité serveur `admin_free_ticket_scan_status()` n'y est pas installée, et le verrou de configuration client `canUseFreeTickets()` reste à `false`.

Le parcours mobile propose la sélection d'un événement gratuit publié, une prévisualisation du nombre de billets encore valables/entrées confirmées, une caméra arrière via `getUserMedia` et `BarcodeDetector` quand disponibles, ainsi qu'un formulaire de saisie/colle manuelle sur les navigateurs ne disposant pas de ce détecteur. La caméra n'est ouverte que sur action explicite après vérification MFA ; ses pistes sont coupées à l'arrêt, à l'abandon du module ou au passage du navigateur en arrière-plan.

La caméra est une amélioration progressive : [BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) n'est pas pris en charge par tous les navigateurs. Aucune image vidéo n'est enregistrée, envoyée à un tiers ou stockée pour analyser un QR.

## Migration SQL, **staging exclusivement**

`supabase/migrations/202610270008_step89_staging_free_ticket_entry.sql` dépend des migrations 87 et **88 consolidée**. Elle ne crée **aucun billet**, aucune personne, aucun droit Premium, aucun encaissement et n'active jamais l'interrupteur `app_private.free_ticketing_gate`.

- Table privée `app_private.free_ticket_entry_attempts` sous RLS, sans `GRANT` aux clients. L'historique technique contient l'événement, l'identifiant interne de l'opérateur, éventuellement celui du billet, un statut de décision et la date. **Aucun code QR brut, hash de QR, nom ou email n'y est enregistré.**
- `public.admin_free_ticket_scan_status()` : vérifie l'admin MFA et indique uniquement si le verrou staging est ouvert.
- `public.admin_list_free_ticket_scan_events()` : liste d'événements gratuits/publics, titre, horaire, capacité et nombres de billets émis/consommés ; aucun nom de supporter.
- `public.admin_scan_free_event_ticket(event_id, qr)` : autorité unique du contrôle. Rejette anonymes, comptes non confirmés, non-administrateurs et session MFA insuffisante via `app_private.is_admin()`. Refuse le contrôle si le verrou OFF ou hors des 90 minutes précédant le début jusqu'à la fin de l'événement.
- **Double scan** : le verrou `FOR UPDATE` sur l'événement puis sur le billet sérialise les lecteurs ; une seule transition `issued → checked_in` et un seul succès peuvent être enregistrés. Les réutilisations renvoient `already_used`; les billets annulés `cancelled`, codes périmés `not_found`.
- La RPC historique `checkin_free_event_ticket` est remplacée par un simple délégué à ce contrôle unique pour ne pas constituer un chemin de contournement.
- `public.admin_free_ticket_entry_report(event_id)` : statistiques et **20 dernières décisions** sans identités ou secrets ; disponible avec MFA AAL2. Une protection contre les appels excessifs limite chaque opérateur à **75 tentatives enregistrées par minute**. Les tentatives supplémentaires sont refusées, sans alourdir le journal.
- `public.service_purge_old_free_ticket_scan_attempts()` : purge manuelle via `service_role` exclusivement après **90 jours** ; à planifier et homologuer par les responsables du club en préproduction.

Les états d'échec sont affichés comme **entrée refusée** ; une erreur réseau, un refus de serveur ou une réponse malformée ne deviennent jamais un « succès ». En cas de coupure ayant suivi une validation, le contrôle exige de relire le **journal côté serveur** : il n'y a pas de validation hors ligne ou de file locale pouvant produire une seconde entrée.

## Sécurité et limites

- Module conditionnel : `adminCapabilities()` vérifie d'abord l'environnement staging exact puis une RPC admin disponible avec verrou actif ; sans cela, aucune commande de scan n'est visible.
- Écran et requêtes protégés : vérification `adminSessionStatus(...)` de l'identité, du rôle, du MFA AAL2 avant tout scan, puis nouvelle vérification dans la transaction PostgreSQL.
- Capture du QR uniquement en mémoire le temps de l'appel HTTPS Supabase ; champ vidé dès la soumission, aucune sauvegarde `localStorage`, `sessionStorage`, cookie, journal console ni service externe.
- La mutation PostgreSQL et ses écritures d'audit appartiennent **à la même transaction**. Le QR n'est pas utilisé comme preuve d'entrée sans état serveur `accepted`.
- **Aucune page ni webhook de paiement LIVE** introduit.

## Validation

Le SQL des étapes 88 et 89 a été assemblé puis exécuté dans **une transaction de vérification suivie de `ROLLBACK`** sur le schéma principal ; résultat : `step89_combined_staging_migrations_rolled_back`. Cela valide les dépendances SQL et la syntaxe sans installer les tables de billets ni les fonctions de contrôle sur le projet principal.

Les tests Node et les contrôles mobiles GitHub Actions sont nécessaires avant fusion. Le résultat et la fusion doivent être consignés après CI.

**Bloqueurs d'homologation** : environnement Supabase staging indépendant, 2 membres fictifs, 2 administrateurs MFA AAL2, et test réel de deux scanners concurrents sur le même billet. La coupure réseau doit être reproduite après validation en base puis vérifiée côté journal ; tester également un billet annulé et un QR régénéré. Aucune autorisation d'ouverture dans ce déploiement.

## Références

- [Supabase — fonctions PostgreSQL et SECURITY DEFINER](https://supabase.com/docs/guides/database/functions).
- [MDN — BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector).
- [MDN — getUserMedia et autorisation caméra](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
