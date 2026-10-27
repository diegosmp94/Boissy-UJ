# Étape 88 — Billetterie gratuite des membres, QR personnel récupérable

**27 octobre 2026 · code et SQL prêts à tester ; aucune réservation ouverte en production.**

## Audit initial

Une migration historique (`202610240001_free_event_tickets_gated.sql`) et un protocole de QR `BUJ1` existaient déjà depuis les étapes 61/65, mais n'étaient pas installés sur le projet principal. Ils couvraient une création atomique de billet, l'annulation propre au compte et le contrôle d'entrée réservé aux administrateurs MFA AAL2.

L'étape 87 ajoute les fenêtres de réservation avec quotas et verrouillage transactionnel ; son déclencheur global refuse l'ouverture de la billetterie avant validation. Le QR initial du prototype n'était renvoyé qu'une seule fois et n'était pas récupérable dans l'espace membre.

## Fichiers de l'étape 88

- `supabase/migrations/202610270007_step88_free_member_ticket_staging.sql` : migration autonome pour **staging Supabase isolé**, basée sur le prototype historique et complétée pour les règles de l'étape 87. **Ne pas appliquer à côté de la migration historique 202610240001** : elle reprend ses tables et fonctions. N'exécuter aucune des deux sur la base principale sans homologation.
- `member-free-tickets.mjs` : « Mes billets gratuits » dans Mon espace, liste des billets du titulaire, réservation, annulation, régénération puis affichage d'un QR personnel.
- `free-ticket-staging-config.mjs` : activation **false par défaut**, refus explicite du projet de production et de toute origine autre que le staging HTTPS configuré.
- `assets/vendor/qrcode.min.js` et `assets/vendor/qrcode.LICENSE` : code source local MIT de qrcodejs (davidshimjs, SHA GitHub source `993e88f396640f881b69f98db7a4d17401ef83ca`), distribué dans les assets du site et chargé depuis **la même origine**. Le contenu du billet **n'est jamais transmis à une API QR externe**.
- `tests/step88-free-ticket-member-qr.test.mjs` : garde OFF, identifiant cryptographique, verrou de jauge, fenêtres, anonymat interdit, récupération par rotation, contrôle admin, QR local et absence de secrets persistants.

## Invariants de sécurité

1. **Interrupteur en base fermé** : `app_private.free_ticketing_gate.enabled=false` à la création et après installation. Aucun bouton public ne peut l'activer. La configuration du frontend est aussi `enabled:false`.
2. **Authentification et propriétaire** : inscription avec identité Supabase vérifiée, email confirmé et absence de compte anonyme. Aucun identifiant de membre n'est accepté en paramètre ; les RPC utilisent uniquement `auth.uid()`. Le navigateur ne peut ni consulter ni modifier les tables privées grâce au RLS et à l'absence de GRANT.
3. **Quota atomique** : verrou `FOR UPDATE` sur l'événement avant le comptage. Un billet **à vie au plus par événement et par membre** (même après annulation), afin d'empêcher les re-réservations abusives. Le total des billets `issued` / `checked_in` ne dépasse jamais la jauge. Si des fenêtres de l'étape 87 sont définies, une fenêtre publique programmée et actuellement ouverte est obligatoire, avec son propre quota.
4. **Conditions gratuites seulement** : événement publié, public, gratuit (0 €), sans priorité Premium, à venir, avec `booking_status='open'`. Une ouverture TEST a sa propre RPC `admin_open_staging_free_event` à niveau admin MFA AAL2, uniquement après **activation manuelle autorisée** de l'interrupteur dans un staging distinct ; le déclencheur global interdit toute autre ouverture.
5. **QR secret** : 32 octets de hasard cryptographique. Seule l'empreinte SHA-256 est enregistrée. `request_free_event_ticket` renvoie le QR initial au membre. `member_reissue_free_event_ticket` invalide l'ancien QR en remplaçant son empreinte après contrôle de propriétaire, billet non utilisé et événement non commencé. Le QR visible ne contient pas de nom, email ou identifiant utilisateur.
6. **Récupération sans conservation du QR** : `member_my_free_event_tickets()` renvoie seulement les informations du billet propres au compte, sans token. Le clic « Afficher un nouveau QR » est une rotation serveur, **pas la récupération d'une ancienne copie secrète**. Le QR est rendu localement dans le navigateur, sans cookie, `localStorage`, `sessionStorage`, URL ou journal.
7. **Annulation** : `cancel_my_free_event_ticket` annule uniquement le billet `issued` du titulaire avant le début de l'événement. Aucun billet `checked_in` n'est annulable ni recréable. Le scan atomique demeure réservé aux administrateurs MFA AAL2 et sera intégré en interface à l'étape 89.

## État de déploiement et validation

La migration stage88 a été exécutée en transaction SQL de **contrôle avec ROLLBACK** sur le projet principal, ce qui valide la syntaxe et les dépendances sans garder aucune modification. Aucune table de billets, réservation, carte QR ou fonction de scan n'a été installée sur la base principale à ce titre.

**Blocage restant pour la recette fonctionnelle :** créer un projet Supabase staging indépendant, habiliter des comptes fictifs (membre A, membre B, admin MFA), appliquer uniquement la migration étape 88 sur sa structure après étape 87, lancer des tests transactionnels en concurrence (dernière place, réservation répétée, annulation, QR régénéré, double scan), valider les droits d'accès et les appareils réels, puis faire approuver la levée du verrou. Aucune date de mise en service ni ouverture financière n'est présumée.

La PR n'active aucun achat, ne crée aucun membre ou billet fictif, ne promet pas d'entrée avant un contrôle serveur. Le reçu de paiement et la billetterie payante ne sont pas concernés.
