# Développement suivant — Réservation gratuite et billet QR à usage unique

**24 octobre 2026.** Extension de la préparation de l'étape 61. Le coeur SQL de réservation et de scan est désormais écrit mais **n'a pas été exécuté, ni activé sur Supabase de production**.

## Ce qui est effectivement préparé

**Migration** : `supabase/migrations/202610240001_free_event_tickets_gated.sql`.

Trois tables dans le schéma privé `app_private` :
- `free_ticketing_gate` : interrupteur **OFF** par défaut, remis à OFF si la migration est réappliquée. Aucun bouton public pour l'activer.
- `free_event_tickets` : une référence événement / membre, hachage SHA-256 du secret QR, statut `issued` / `cancelled` / `checked_in`, dates de changement. **Jamais** le QR en clair, l'email ou le nom dans cette table.
- `free_event_ticket_audit` : seulement les identifiants de transaction, acteur autorisé, action et date, sans QR brut.

Trois fonctions `SECURITY DEFINER SET search_path=''` avec `EXECUTE` réservé au rôle `authenticated`, plus contrôle **réel** côté serveur dans chaque fonction :
1. `request_free_event_ticket(event_id)` : exige une session de membre non anonyme et un événement publié, **gratuit, public, ouvert, futur**, avec jauge connue et sans accès Premium prioritaire. Place un verrou `FOR UPDATE` sur l'événement **avant** de compter les billets `issued` et `checked_in`. Refuse la jauge pleine et toute deuxième réservation pour un même membre/événement. Génère un secret de **32 octets aléatoires par pgcrypto** et ne stocke que son SHA-256. Renvoie une fois `BUJ1:<uuid>:<hex>`.
2. `cancel_my_free_event_ticket(event_id)` : sous la même porte fermée, n'annule qu'un billet **émis, appartenant au membre authentifié, avant le début** ; ne peut pas annuler un billet déjà utilisé ou d'autrui.
3. `checkin_free_event_ticket(event_id,qr)` : exige administrateur **et MFA AAL2** via `app_private.is_admin()` existante. Vérifie format, bon événement, fenêtre d'accueil autorisée (90 minutes avant le début jusqu'à la fin), SHA-256 et statut encore `issued`, puis verrouille et passe à `checked_in` **une fois seulement**. Deux scans simultanés ne peuvent pas valider deux entrées à partir du même billet.

La lecture du verrou global avec `FOR SHARE` permet de sérialiser un changement d'interrupteur avec une réservation / annulation / entrée en cours. Les tables privées ont RLS activé, sans politique publique ni droits directs pour `anon` ou `authenticated`. Le vote Awards et les paiements sont hors périmètre.

### Ce qui n'est volontairement pas activé

- Le flag reste à **false**, et sa mise à jour doit rester une action SQL privilégiée, approuvée et tracée par le club.
- Le frontend public n'a pas de bouton de réservation actif ni de lecteur QR : même après la migration, aucune émission n'est possible tant que la porte reste fermée.
- Le code n'a pas été exécuté sur une instance PostgreSQL isolée : **les tests Node vérifient le contrat du SQL, pas une transaction réellement exécutée**.
- Aucune réservation, identité réelle ou secret n'a été créé en production.

## Recette indispensable sur un environnement Supabase isolé

1. Avec la permission du responsable, préparer un Supabase local Docker sans liaison cloud ou un autre projet staging autonome. Vérifier PostgreSQL 17 et `extensions.pgcrypto`.
2. Réconcilier les migrations historiques ; tester l'application de la nouvelle migration **dans l'ordre, sur le schéma isolé**.
3. Exécuter `scripts/free-ticket-staging-privileges.sql` en lecture seule : le drapeau doit être OFF, les trois tables privées couvertes RLS, les droits anonymes absents et les seuls RPC autorisés explicitement.
4. Avec un faux événement gratuit futur à jauge **1**, deux comptes Auth fictifs distincts, aucun compte réel et les deux sessions simultanées, vérifier : exactement **un succès**, un échec « places épuisées » ; aucune ligne supplémentaire. Refaire avec jauge 2 puis un même compte deux fois : toujours un seul ticket de ce compte.
5. Vérifier que le QR retourné ne contient aucune donnée personnelle et que la ligne stockée ne comporte que le condensé SHA-256. Essayer un QR falsifié, un QR d'un autre événement et un compte non connecté.
6. Avant l'ouverture de l'événement, annuler le billet du premier compte. Vérifier l'annulation, qu'un deuxième compte peut prendre la place libérée, et que le premier compte ne peut pas contourner sa limite d'un billet par événement en re-réservant.
7. Avec **deux comptes de contrôleurs autorisés AAL2**, simuler deux appels `checkin_free_event_ticket` concurrents sur le même QR pendant la fenêtre fictive : **un seul TRUE**, un FALSE. Avec MFA AAL1, utilisateur simple et invité : accès refusé. Après scan, annulation impossible.
8. Vérifier la coupure de l'interrupteur : le service refuse immédiatement les nouveaux tickets, annulations et scans, sans interférence avec le site vitrine. Vérifier le journal privé et l'absence de QR secret dans les logs.
9. Définir et faire approuver les règles de capacité, de retrait de billet, de conservation, les événements d'annulation/report, les contrôleurs responsables et les obligations RGPD. Conserver un **PV expurgé** de la recette.

**Ne pas activer la billetterie** tant que l'ensemble n'est pas homologué. Une réussite du contrôle statique `npm test` ne constitue jamais une preuve d'exploitation réelle.

## Points techniques à auditer avant mise en service

La règle volontairement stricte est **un seul billet à vie par compte et événement**, même après annulation. Cela simplifie l'anti-abus mais exige une procédure encadrée pour une réservation incorrecte. Les billets déjà utilisés restent comptés dans la jauge. Toute réouverture de billets ou tout événement reprogrammé devra nécessiter une revue explicite, et un scan doit rester possible seulement pendant la plage confirmée du club.

Une piste future est d'ajouter un contrôleur d'entrée mobile et un justificatif récupérable dans Mon espace, avec partage du QR seulement au détenteur du compte et rotation vérifiée. Ces fonctions **ne sont pas codées dans ce lot**.

**État : backend de tickets gratuits écrit et fail-closed ; migration, tests à deux comptes/deux scanners et activation non réalisés.**
