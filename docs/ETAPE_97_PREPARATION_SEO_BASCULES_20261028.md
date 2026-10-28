# Étape 97 — SEO préparé, indexation verrouillée et bascules sûres

**28 octobre 2026 — fin de la roadmap de développement technique, sans homologation commerciale ni juridique.**

## 1. Préparation du référencement et du partage

La page publique dispose désormais de :
- la description et le titre existants ;
- une URL canonique explicite correspondant à l'actuelle URL GitHub Pages du club ;
- les balises Open Graph `og:site_name`, `og:locale`, `og:url`, image et texte alternatif de l'écusson, et les métadonnées Twitter/X `summary`, titre et description ;
- une CSP inchangée, un refus des moteurs (`meta robots = noindex, nofollow`) et un fichier `robots.txt` interdisant **toutes les URL**, y compris les anciennes routes hash.

**Ce travail prépare les aperçus des partages, pas l'indexation.** La présence d'une URL canonique n'autorise pas un moteur à indexer le site. Aucune entrée sitemap, JSON-LD `Organization` ou `SportsOrganization`, balise vérificative Google ou Analytics n'est publiée : plusieurs informations juridiques et les coordonnées officielles du responsable restent à homologuer par le club. Avec l'architecture SPA en routes hash, les pages d'équipes ou d'actualités ne peuvent pas être considérées comme des URLs SEO distinctes prêtes à indexer, sans refonte éventuelle du routage et du rendu.

## 2. Verrous de compilation

`public-release-locks.mjs` expose uniquement la configuration **de la publication GitHub Pages** :
- indexation `false` ;
- paiements LIVE `false` ;
- paiements TEST sur le site public `false` ;
- billetterie gratuite ouverte au public `false` ;
- votes Premium ouverts sur le public `false` ;
- synchronisation automatique FFF `false`.

Ces valeurs sont **des verrous de construction et de présentation**, pas des autorisations serveur : la vraie billetterie doit conserver sa protection côté Supabase, les paiements doivent rester régis par les clés, les webhooks et les contrats Stripe, et un droit Premium doit être établi par les règles de base de données. Le connecteur FFF reste sans autorisation partenaire et ne peut pas être déclenché automatiquement.

`scripts/seo-release-guard.mjs` refuse une compilation de Pages si :
- une seule des six fonctionnalités publiques susmentionnées est activée ;
- `FFF_FEED_STATUS` change ou `FREE_TICKET_STAGING.enabled` devient vrai dans la publication publique ;
- le fichier robots cesse d'être exactement `Disallow: /`, le meta noindex disparaît ou une balise d'indexation contradictoire apparaît ;
- la balise canonique, l'image OG, les métadonnées minimales de partage ou les règles de sécurité publiques deviennent incohérentes ;
- des données structurées ou URL alternatives non homologuées apparaissent.

Le contrôle est partagé par **trois chemins** :
1. `scripts/build-preview.mjs` avant de générer la version statique ;
2. `scripts/audit-preview.mjs` lors de la vérification des fichiers dans `dist/` ;
3. `scripts/write-public-release.mjs` avant d'écrire le manifeste du commit publié.

Le Control Center, dans l'état de mise en service, présente les verrous du build et rappelle que **cette lecture n'atteste pas l'état réel des services externes**. Il n'existe **aucun bouton « activer les paiements » ou « ouvrir Google »**, ni aucune mutation Supabase dans cette étape.

## 3. Séquence de mise en service ultérieure, après accord du club

1. **Preuves d'identité** : le club confirme le responsable légal du site, ses coordonnées, les mentions légales, la politique de confidentialité, les droits à l'image et les personnes habilitées à gérer les mineurs.
2. **Recette avec comptes réels** : sessions AAL1/AAL2, rôles utilisateurs, interdiction d'accès inter-comptes, MFA et procédures d'effacement et de récupération.
3. **Sauvegarde et exploitation** : restauration chiffrée testée sur un projet isolé, journaux privés et alertes effectivement opérationnelles, correction des risques connus.
4. **Supports** : Safari iPhone / Android, VoiceOver / TalkBack, formulaires et parcours d'inscription validés par l'association.
5. **FFF** : accord écrit de la fédération / du district, contrat de données, rapprochement avec les cinq équipes et contrôle de republication ; sinon gestion manuelle uniquement.
6. **Billetterie / Premium / Stripe** : homologation séparée sur Supabase staging distinct avec transactions simulées, tickets et QR, contrôles des remboursements, droit légal d'exercer l'activité et approbation des responsables avant toute activation LIVE.
7. **SEO après homologation** : vérifier le nom de domaine officiel, envisager des URL publiques indexables, déclarer seulement les pages réellement publiques, adapter `robots.txt`, les metas, le sitemap et les déclarations aux moteurs. Ce sera une **nouvelle procédure de changement vérifiée**, et non un effet secondaire du déploiement technique.

## 4. Ce que l'étape livre — et ce qu'elle ne certifie pas

Le code termine la roadmap technique prévue aux étapes 66 à 97 sous réserve des tests automatiques, de la CI et du contrôle de déploiement. Le statut de conformité juridique, la disponibilité permanente, les appels FFF, les transactions réelles et la validation multi-utilisateur ne sont **pas** certifiés par ce développement.

Aucun compte, adresse mail, preuve de paiement, objet Storage, rencontre, candidature ni résultat n'est généré ou modifié. L'environnement de production conserve ses verrous et son mode vitrine technique non indexable.
