# Correctif public — Prévenir les chargements interminables

**24 octobre 2026 — Lot de fiabilité sans modification Supabase.**

Après l'étape 64, plusieurs rubriques ont reçu des limites de requête HTTP, mais six composants exposés aux supporters faisaient encore des appels `fetch` sans date limite. Si la connexion réseau ou Supabase cessait de répondre, une page pouvait conserver le message « Chargement… », ou un prochain match ne plus se synchroniser lors des réapparitions de l'onglet.

## Corrections livrées

Le module commun `public-catalog-timeout.mjs`, déjà testé, est maintenant réutilisé avec un délai de **12 secondes** et un relais d'annulation lors du changement de page :

1. **Prochain match sur l'accueil :** libération du verrou de synchronisation même sur timeout, repli sur le calendrier externe distinctement étiqueté « non confirmé par le club ».
2. **Bandeau victoire collective :** arrêt de la requête en attente ; aucune félicitation non vérifiée inventée en cas d'échec.
3. **Agenda :** arrêt des chargements des trois catalogues ; message de disponibilité, export ICS désactivé sans données du club.
4. **Fiche d'équipe :** fermeture des requêtes Effectif/Encadrement/statistiques/actualités en cas de blocage ; aucun nom privé ou non consenti publié.
5. **Identité du club :** affichage du message de source indisponible au lieu d'une attente infinie.
6. **Nous rejoindre / Infos pratiques :** chargements bornés ; les contacts, entraînements et recrutements sans publication officielle ne sont pas inventés.

Un timeout ou le départ d'une route met fin aux requêtes HTTP de cette route et nettoie le temporisateur. L'abandon d'une requête de lecture ne modifie jamais de données.

## Vérifications

Les nouveaux tests simulent un serveur ne répondant jamais et prouvent l'abandon des requêtes sur les **six flux** ; vérifient le maintien des contrôles de données et l'absence de secrets dans le navigateur. Les 16 routes Chromium et les tests Node existants sont exécutés avant chaque fusion.

**Limites :** les tests de réseaux simulés ne prouvent ni la disponibilité future de Supabase ni la validité des données réelles. Les chantiers officiels de résultats, effectifs consentis, RGPD, RLS et MFA restent ouverts. Aucun paiement, billet, vote ou import FFF activé.
