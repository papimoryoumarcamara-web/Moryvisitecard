# Carte MOC : guide d'installation, de test et de publication

Carte de visite numérique de **Mory Oumar Camara**. C'est une appli web installable (PWA) qui fonctionne **100 % hors ligne**.

---

## 1. Contenu du dossier

| Fichier ou dossier | Rôle |
|---|---|
| `index.html` | Page de l'appli |
| `css/app.css` | Design Éco-tech, mode clair/sombre, animations |
| `js/app.js` | Logique : écrans, QR, scanner, carnet, exports, animations |
| `js/data.js` | **Tes informations** (version publique de la carte) |
| `js/vcard.js` | Création et lecture des fiches contact (vCard 3.0) |
| `js/lib/` | Bibliothèques QR embarquées : `qrcode.js` (MIT) et `jsQR.js` (Apache 2.0) |
| `fonts/` | Polices Outfit et Work Sans (licence OFL), embarquées |
| `assets/` | Ta photo (`photo.jpg`) et sa version réduite pour le .vcf |
| `icons/` | Icônes de l'appli (192, 512, maskable, iPhone) |
| `manifest.webmanifest` | Fiche d'installation de la PWA |
| `sw.js` | Service worker : met tout en cache pour le hors ligne |

Aucun fichier n'est chargé depuis internet : pas de CDN, pas de police en ligne. Aucune donnée n'est envoyée à un serveur.

---

## 2. Publier gratuitement sur GitHub Pages (une seule fois)

L'appli doit être en ligne **une première fois**, en `https://`, pour pouvoir s'installer sur un téléphone. Ensuite, elle marche sans internet.

1. Crée un compte gratuit sur **github.com**. Ton pseudo fera partie de l'adresse.
2. Clique sur **New repository** (nouveau dépôt).
   - **Nom du dépôt** : choisis-le, par exemple `carte`. Ton adresse sera alors `https://TON-PSEUDO.github.io/carte/`.
   - Pour avoir l'adresse courte `https://TON-PSEUDO.github.io/`, nomme le dépôt exactement `TON-PSEUDO.github.io`.
   - Laisse le dépôt **Public** : c'est obligatoire pour GitHub Pages gratuit.
3. Dans le dépôt, clique sur **Add file → Upload files**. Glisse **tout le contenu** du dossier `carte-mory` (les fichiers et les sous-dossiers, pas le dossier lui-même), puis clique sur **Commit changes**.
4. Va dans **Settings → Pages**. Sous « Branch », choisis `main` et `/ (root)`, puis **Save**.
5. Attends 1 à 2 minutes. Ton adresse s'affiche en haut de la page **Settings → Pages**.

> Le dépôt est public : n'importe qui peut voir `js/data.js`, ta photo et tes coordonnées. C'est normal pour une carte de visite, mais n'y mets rien de privé.

**Le lien dans le QR** : quand tu ouvres l'appli depuis cette adresse, elle l'ajoute **automatiquement** dans ton QR. Si une personne scanne le QR puis touche ce lien avec internet, elle voit ta carte animée avec ta photo.

---

## 3. Installer l'appli

### Android (Chrome)
1. Ouvre ton adresse GitHub Pages dans **Chrome**.
2. Va dans **Paramètres de l'appli → Installer l'appli**, ou dans le menu ⋮ → **Installer l'application**.
3. L'icône « Carte MOC » apparaît sur l'écran d'accueil. L'appli s'ouvre en plein écran.

### iPhone (Safari obligatoire)
1. Ouvre ton adresse dans **Safari**. Chrome ne permet pas l'installation sur iPhone.
2. Touche **Partager**, puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvre l'appli une fois avec internet pour que tout soit mis en cache.

### PC (Chrome ou Edge)
- Clique sur l'icône **Installer** dans la barre d'adresse, ou passe par le menu → **Installer Carte MOC**.

---

## 4. Checklist de tests à faire toi-même

Coche chaque ligne.

### A. Mode avion (ton téléphone)
- [ ] Ouvre l'appli une fois avec internet, puis active le **mode avion**.
- [ ] Ferme complètement l'appli et rouvre-la : le splash s'affiche (≈ 2,8 s, bouton « Passer »), puis la carte.
- [ ] Les onglets Carte, Profil, QR, Scanner et Carnet fonctionnent.
- [ ] Modifie une info dans **Paramètres → Enregistrer**, puis vérifie la carte et le QR.
- [ ] Touche **Afficher en plein écran** : QR sur fond blanc, et l'écran ne s'éteint pas.

### B. Scan avec l'appareil photo natif d'un **autre** téléphone, lui aussi en mode avion
- [ ] **iPhone** : ouvre l'app Appareil photo et vise le QR. Une bannière « Contact » apparaît : touche-la, puis **Créer un contact**. Vérifie le nom, le titre, le téléphone, l'email, la ville et la note CV.
- [ ] **Android** : ouvre l'appareil photo ou Google Lens et vise le QR, puis **Ajouter aux contacts**. Sur les téléphones sans lecteur intégré, utilise Google Lens ou l'app de scan du fabricant.
- [ ] Vérifie que les accents s'affichent bien (« Étudiant », « Guinée »).

### C. Scanner intégré (hors ligne)
- [ ] Onglet **Scanner → Activer la caméra**, puis vise le QR d'une autre personne. Sa fiche s'ouvre.
- [ ] **Garder dans mon carnet**, puis onglet **Carnet** : la carte est là, et la recherche fonctionne.
- [ ] **Depuis une image** : choisis une capture d'écran d'un QR.

### D. Lisibilité du QR
- [ ] Sur écran : à 15–25 cm, luminosité au maximum.
- [ ] Imprimé : **au moins 5 cm de côté** en mode « Contact + CV », ou 3,5 cm en mode « Essentiel ».
- [ ] En plein soleil : mets-toi à l'ombre de ta main, luminosité au maximum. Si ça ne passe pas, choisis **Essentiel** : le QR est moins dense, donc plus facile à lire.

### E. Animations
- [ ] Sur un téléphone modeste : les animations restent fluides. Sinon, va dans **Paramètres → Animations → Sobres**.
- [ ] Active « Réduire les animations » (iPhone : Accessibilité → Mouvement ; Android : Accessibilité → Supprimer les animations). L'appli passe automatiquement en mode réduit.

---

## 5. Mettre à jour la carte

### Sur ton téléphone uniquement
Va dans **Paramètres**, modifie tes infos, puis **Enregistrer**. Le QR est mis à jour aussitôt, hors ligne.

### Pour mettre à jour aussi la page en ligne (celle du lien dans le QR)
1. Sur GitHub, ouvre `js/data.js`, puis clique sur le crayon (Edit). Modifie tes infos et clique sur **Commit changes**.
2. Ouvre `sw.js` et augmente le numéro : `const VERSION = "carte-moc-v2";` devient `"carte-moc-v3"` (puis `v4` la fois suivante, etc.). Clique sur **Commit**.
3. Rouvre l'appli avec internet : un message « Nouvelle version installée » s'affiche, et la mise à jour est faite.

### Changer la photo
- Dans l'appli : **Paramètres → Photo → Changer**. La photo est gardée sur ton téléphone.
- Pour la page en ligne : remplace `assets/photo.jpg` (carré, environ 400×400 px) et `assets/photo-vcf.jpg` (200×200 px) sur GitHub, puis augmente `VERSION` dans `sw.js`.

---

## 6. Alternative : Netlify (aussi gratuit)
1. Va sur **app.netlify.com/drop**.
2. Glisse le dossier `carte-mory` entier.
3. Netlify donne une adresse `https://xxxx.netlify.app`. Tu peux changer `xxxx` dans **Site settings → Change site name**.

---

## 7. Limites connues

- **Luminosité** : aucune appli web ne peut régler la luminosité de l'écran. L'appli affiche un fond blanc pur et garde l'écran allumé, mais c'est à toi de monter la luminosité.
- **Photo et animations dans le QR** : c'est impossible. Un QR ne contient que du texte, au maximum environ 3 000 caractères. Le QR contient donc ta fiche contact avec ton CV en texte, plus le lien vers ta carte animée.
- **Densité** : le mode « Contact + CV » fait environ 1 160 octets (QR de 113×113 carrés). Il est très lisible sur écran, mais il faut au moins 5 cm à l'impression. Le mode « Essentiel » fait environ 420 octets (81×81 carrés).
- **Caméra du scanner intégré** : elle ne marche qu'en `https://` (GitHub Pages) ou sur l'ordinateur en local.
- **iPhone** : la caméra du scanner intégré et le maintien de l'écran allumé demandent un iOS récent (16.4 ou plus).
