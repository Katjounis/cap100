# Cap 100

Application web personnelle de transformation physique : poids, alimentation, séances, renforcement musculaire, habitudes, mensurations, photos et objectifs. Pensée pour accompagner le trajet de 130 kg vers environ 100 kg (novembre 2027), en préservant la musculature.

- **100 % locale** : toutes les données sont stockées dans le navigateur (IndexedDB). Aucun compte, aucun serveur, aucune requête réseau avec tes données. Les polices sont hébergées avec l'application (pas d'appel à Google Fonts).
- **Sans dépendance ni compilation** : HTML, CSS et JavaScript. Les graphiques sont dessinés en SVG.
- **PWA** : installable sur téléphone, fonctionne hors connexion.

## Mise en ligne sur GitHub Pages

1. Crée un dépôt sur GitHub (par exemple `cap100`). Il peut être privé si ton offre GitHub le permet pour Pages, sinon public : le dépôt ne contient que le code, jamais tes données.
2. Envoie le contenu de ce dossier à la racine du dépôt :
   ```bash
   git init
   git add .
   git commit -m "Cap 100"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/cap100.git
   git push -u origin main
   ```
   (ou glisse-dépose les fichiers dans l'interface web de GitHub : « Add file » → « Upload files »).
3. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
4. Après une minute environ, l'application est disponible sur `https://<ton-compte>.github.io/cap100/`.

Le fichier `.nojekyll` évite que GitHub transforme les fichiers.

## Installer sur le téléphone

- **Android (Chrome)** : ouvre l'adresse, menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

Les données de l'application installée et celles d'un onglet de navigateur peuvent être séparées selon les appareils. Utilise **Réglages → Exporter / Importer** pour les transférer.

## Sauvegardes

**Réglages → Mes données → Exporter (JSON)** crée un fichier contenant tout (photos incluses si l'option est cochée). **Importer** restaure une sauvegarde en remplaçant les données actuelles. Exporte régulièrement : si tu effaces les données du navigateur, elles disparaissent. Le bouton « Protéger le stockage » demande au navigateur de ne pas les effacer automatiquement.

## Mettre à jour l'application

Remplace les fichiers dans le dépôt puis incrémente `VERSION` dans `sw.js` (par exemple `cap100-v1.2.1`) pour que les téléphones récupèrent la nouvelle version. Tes données ne sont pas touchées.

## Structure

```
index.html             Coquille de l'application
manifest.webmanifest   Manifeste PWA
sw.js                  Service worker (cache hors connexion)
css/app.css            Design system (thèmes clair et sombre)
fonts/                 Barlow Condensed et Figtree (licence SIL OFL)
icons/                 Icônes de l'application
js/util.js             Dates, formats, icônes
js/db.js               Stockage IndexedDB + cache mémoire
js/domain.js           Calculs : tendance du poids, estimations, badges, habitudes
js/charts.js           Graphiques SVG interactifs
js/ui.js               Fenêtres, feuilles mobiles, toasts, confirmations
js/forms.js            Saisies : poids, repas, activité, journée du calendrier…
js/workout.js          Mode séance de renforcement
js/recipes-data.js     Base de 28 recettes et ingrédients (rayons, unités d'achat)
js/kitchen.js          Recettes, planning des repas, liste de courses
js/prices.js           Enseignes, prix de référence et budget des courses
js/coach.js            Modèle de dépense, prévisions, charges suggérées, conseils
js/dashboard.js …      Une page par fichier (calendar, nutrition, training, body, habits, goal, stats, settings)
js/demo.js             Données de démonstration (supprimables)
js/app.js              Navigation, thème, raccourcis, démarrage
```

## Méthode de calcul

- **Progression** : calculée sur la moyenne des pesées des 7 derniers jours. Une pesée isolée ne valide pas un palier.
- **Tendance lissée** : moyenne mobile exponentielle des pesées ; **rythme** : pente de cette tendance sur 4 semaines.
- **Estimation d'une date** : indicative, recalculée en continu, jamais présentée comme une promesse.
- **Besoins caloriques** : formule de Mifflin-St Jeor × niveau d'activité, déficit plafonné à 25 % et jamais sous le métabolisme de base. Valeurs modifiables. Ce ne sont pas des conseils médicaux.
- **Calories des activités** : équivalents métaboliques (MET) selon type, durée, intensité, vitesse et poids.
- **Max estimé** (renforcement) : formule d'Epley, pour comparer des séries différentes.
- **Dépense du jour (Coach)** : métabolisme × 1,15 + pas × 0,0004 × poids + énergie nette des activités, puis calibrée sur tes données (apports notés + variation de la tendance du poids × 7 700 kcal/kg) dès que 10 jours de repas sont notés sur 2 à 4 semaines.
- **Projection** : simulation jour par jour, le déficit diminuant d'environ 15 kcal par jour et par kilo perdu.
- **Charges suggérées** : +2,5 kg (+5 kg sur les gros mouvements de jambes) quand toutes les séries atteignent les répétitions visées ; −10 % après deux séances ratées à la même charge.
- **Course** : formule de Riegel à partir de la meilleure sortie des 90 derniers jours.

## Entraînement sans salle

La bibliothèque contient 46 exercices au poids du corps, aux haltères, au kettlebell et aux élastiques, chacun avec un conseil de technique. Coche ton matériel (Sport → Exercices, ou Réglages) : seuls les exercices réalisables sont proposés. Quatre séances types sont incluses : haut du corps aux haltères, bas du corps et fessiers, abdos et gainage, full body express.

## Prix des courses

- Prix de référence : ordres de grandeur 2026 en marque distributeur, niveau E.Leclerc. Ce sont des estimations.
- Indices d'enseigne (E.Leclerc = 100) : classement UFC-Que Choisir 2026 pour les enseignes avec drive, étude discount 2025 pour Lidl et Aldi. Netto, Casino/Franprix et Monoprix sont estimés.
- « À la caisse » compte les paquets entiers ; « utilisé » ne compte que les quantités de tes recettes. Les produits de longue conservation (huile, miel, whey, sauce soja…) sont comptés au prorata.
- Touche un article de la liste pour choisir l'enseigne (pour l'article ou tout le rayon) et saisir le prix réel de l'étiquette : il remplace l'estimation pour cette enseigne.
