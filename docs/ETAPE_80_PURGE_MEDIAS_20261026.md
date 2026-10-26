# Étape 80 — Retrait et purge sécurisée des médias privés

**26 octobre 2026 — Livraison de développement.** Aucun média du club ni objet réel n'est créé, affiché ou supprimé dans le cadre de ce changement. Les droits à l'image, notamment pour les mineurs, restent soumis à validation humaine.

## Circuit de retrait depuis le Control Center

Dans **Galeries et vidéos**, un administrateur MFA AAL2 peut sélectionner un média existant, choisir « Préparer le retrait définitif » et confirmer une deuxième fois. Le flux est **irréversible** :

1. `admin_begin_news_media_purge(id)` verrouille la publication et la fiche, retire `visible` et `rights_reviewed`, journalise l'ancienne et la nouvelle fiche et enregistre une demande privée et durable, unique par média et chemin. La galerie publique ne peut plus obtenir de **nouveaux liens signés**.
2. Le navigateur utilise l'API officielle `storage.from('boissy-uj-approved').remove([path])`, jamais un `DELETE` SQL dans `storage.objects`. Un RLS `DELETE` n'autorise que les chemins explicitement mis en attente par la RPC et un administrateur AAL2 ; le bucket reste privé, sans droits de listage, de remplacement ou d'effacement anonyme. L'ancienne politique d'upload refuse maintenant tout chemin en attente ou déjà purgé, pour bloquer une copie tardive.
3. `admin_finish_news_media_purge(id)` vérifie **en base** que l'objet Storage a bien disparu, supprime la fiche média et marque la demande terminée. La trace privée de l'opération reste conservée.

### Reprise après panne

Un upload non abouti à l'étape 79 peut aussi être purgé (objet absent). Si le réseau est interrompu entre deux phases, la demande **reste en attente et le média invisible** ; cliquer de nouveau réutilise le même chemin sans réapprouver le fichier. L'interface ne déclare jamais la suppression physique réussie en cas de réponse incertaine. Une fois la purge finalisée, la liste est rafraîchie.

La protection SQL bloque également toute modification/republication d'un média ayant une demande de purge, et empêche qu'une suppression de l'article laisse derrière elle un fichier Storage orphelin. Les suppressions directes d'objets dans Supabase Dashboard doivent rester réservées aux personnes habilitées.

### Limites et gardes

- Un lien signé déjà émis peut fonctionner **jusqu'à l'effacement effectif de son objet** ; le retrait des métadonnées seul ne peut pas invalider une URL préexistante. Une fois le fichier supprimé, les anciennes URLs ne peuvent plus servir ses octets.
- Une panne Storage peut laisser durablement une demande de purge en attente et un fichier privé encore présent ; le responsable doit réessayer, superviser les demandes et ne pas promettre l'effacement total avant finalisation.
- Le traitement de la suppression des **comptes / données personnelles**, les délais légaux de conservation, les consentements des représentants légaux et l'homologation multi-comptes ne sont pas résolus par cette étape.
- L'interface ne fournit pas de lien ou clé de service privilégiée : seul le client Auth de l'administrateur utilise RLS et MFA AAL2.

**Livrables :** migration `supabase/migrations/202610260017_media_purge_queue.sql`, module `admin-media-purge.mjs`, intégration dans `admin-news-media.mjs`, CSS et tests `tests/step80-media-purge.test.mjs`.

**Suivant : étape 81, fiches publiques de personnes publiables avec consentements explicites.**
