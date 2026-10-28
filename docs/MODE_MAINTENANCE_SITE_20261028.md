# Mode maintenance — Boissy-UJ (28 octobre 2026)

## Activer ou désactiver

Depuis GitHub, ouvrir **diegosmp94/Boissy-UJ → Actions → Activer ou désactiver la maintenance Boissy-UJ → Run workflow** (branche `main`). Sélectionner **activer** pour afficher le message de maintenance ou **desactiver** pour restaurer le site.

L'action valide le choix, modifie uniquement `site-maintenance-config.mjs`, crée un commit sur `main` si nécessaire et déclenche explicitement le workflow **Publier le site public Boissy-UJ**. C'est important : un commit généré par le jeton GitHub Actions ne déclenche pas automatiquement un autre workflow `push`. Vérifier la réussite du workflow de publication et la version réellement visible avant de considérer le changement appliqué. Le cache GitHub Pages peut retarder l'affichage pendant un court moment.

**Par défaut, la maintenance est désactivée.** Les interventions futures ne l'activeront pas automatiquement : il faut sélectionner *activer*. Les modifications de code faites pendant une maintenance conservent le drapeau actif jusqu'à *desactiver*.

## Comportement

`index.html` utilise `site-entry.mjs` qui vérifie la configuration publique avec une requête qui évite le cache, avant de charger `app.js`. Lorsque le drapeau est actif, la nouvelle visite est redirigée vers `maintenance.html`, une page locale, responsive, sans script ni formulaire ni ressource distante. Si la configuration ne peut pas être vérifiée, l'entrée publique affiche aussi la maintenance plutôt qu'une application partiellement initialisée. Le site normal n'est pas modifié hors mode maintenance.

Pendant ce mode, la CI remplace le test de navigation métier par un contrôle dédié des ressources de maintenance. Le contrôle après publication vérifie la page et le drapeau effectivement publiés, en plus du SHA de commit.

## Limites à connaître

GitHub Pages sert des fichiers statiques. Ce mode n'est ni un pare-feu ni un contrôle d'autorisation : les onglets déjà ouverts et les fichiers appelés directement peuvent rester accessibles. La maintenance **ne suspend pas** Supabase ni Stripe. Les migrations sensibles et l'arrêt des paiements exigent toujours des protections côté serveur. Aucun secret ou rôle d'administration n'est ajouté au site. Les flags financiers existants restent désactivés.
