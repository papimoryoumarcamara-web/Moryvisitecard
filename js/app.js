/* =====================================================================
   CARTE DE VISITE MOC — logique de l'appli
   ---------------------------------------------------------------------
   Tout fonctionne hors ligne : aucune requête vers un serveur externe.
   Données enregistrées uniquement sur l'appareil (localStorage).
   Animations : Web Animations API + CSS, uniquement transform/opacity.
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1. OUTILS
     ------------------------------------------------------------------ */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var EASE = "cubic-bezier(.2,.8,.2,1)";
  var RESSORT = "cubic-bezier(.34,1.56,.64,1)";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icone(nom, cls) { return '<svg class="ic ' + (cls || "") + '" aria-hidden="true"><use href="#i-' + nom + '"/></svg>'; }
  function cloner(o) { return JSON.parse(JSON.stringify(o)); }
  /* Exécute fn à la fin d'une animation, avec une sécurité par minuteur :
     si le navigateur suspend l'animation, l'interface ne reste jamais bloquée. */
  function apres(animation, ms, fn) {
    var fait = false;
    var go = function () { if (!fait) { fait = true; fn(); } };
    animation.onfinish = go;
    setTimeout(go, ms + 60);
  }
  function vibrer(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) { /* rien */ } }

  /* Stockage local sécurisé (navigation privée, stockage plein…) */
  var Stock = {
    lire: function (k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    ecrire: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    effacer: function (k) { try { localStorage.removeItem(k); } catch (e) { /* rien */ } }
  };
  var CLE_PROFIL = "moc.profil", CLE_REGLAGES = "moc.reglages", CLE_CARNET = "moc.carnet";

  var estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var tactile = window.matchMedia("(pointer: coarse)").matches;
  var mqReduit = window.matchMedia("(prefers-reduced-motion: reduce)");
  function estInstallee() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true;
  }

  /* ------------------------------------------------------------------
     2. ÉTAT
     ------------------------------------------------------------------ */
  /* Mode visiteur : la personne a ouvert le lien en ligne contenu dans le QR */
  var VISITEUR = /^#v/.test(location.hash) || /[?&]v(=|&|$)/.test(location.search);
  var DEFAUT = window.PROFIL_DEFAUT;
  var profil = VISITEUR ? cloner(DEFAUT) : Object.assign(cloner(DEFAUT), Stock.lire(CLE_PROFIL, {}));
  var reglages = Object.assign({ theme: "auto", anim: "spectaculaire", qrMode: "complet" }, Stock.lire(CLE_REGLAGES, {}));
  var carnet = Stock.lire(CLE_CARNET, []);
  var vueActive = "carte", vuePrecedente = "carte";
  var ORDRE = ["carte", "profil", "qr", "scanner", "carnet", "reglages"];
  var invitationInstall = null;

  function nomComplet(p) { return ((p || profil).prenom + " " + (p || profil).nom).trim(); }
  function slug() { return nomComplet().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, ""); }
  function photoSrc() { return profil.photo || "assets/photo.jpg"; }

  /* Niveau d'animation effectif : « réduire les animations » du système a priorité */
  function anim() { return mqReduit.matches ? "reduit" : reglages.anim; }

  function appliquerReglages() {
    if (reglages.theme === "auto") html.removeAttribute("data-theme");
    else html.setAttribute("data-theme", reglages.theme);
    html.setAttribute("data-anim", anim());
  }
  mqReduit.addEventListener && mqReduit.addEventListener("change", appliquerReglages);

  /* Adresse publique de la carte (ajoutée au QR une fois l'appli en ligne) */
  function lienEnLigne() {
    var base = (profil.lienEnLigne || "").trim();
    if (!base && location.protocol === "https:" && !/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
      base = location.origin + location.pathname.replace(/index\.html$/, "");
    }
    if (!base) return "";
    return base.replace(/#.*$/, "") + "#v";
  }

  /* ------------------------------------------------------------------
     3. QR CODE (bibliothèque locale qrcode-generator, en UTF-8)
     ------------------------------------------------------------------ */
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

  /* Choisit le meilleur niveau de correction d'erreur pour garder un QR lisible */
  function fabriquerQR(texte) {
    var essais = [["Q", 12], ["M", 22], ["L", 40]];
    for (var i = 0; i < essais.length; i++) {
      try {
        var q = qrcode(0, essais[i][0]);
        q.addData(texte, "Byte");
        q.make();
        var n = q.getModuleCount(), v = (n - 17) / 4;
        if (v <= essais[i][1]) return { q: q, ecc: essais[i][0], version: v, modules: n, octets: VCard.octets(texte) };
      } catch (e) { /* trop long pour ce niveau : on essaie le suivant */ }
    }
    return null; // dépasse la capacité maximale d'un QR
  }

  function texteQR(mode) {
    return VCard.construire(profil, { mode: mode || reglages.qrMode, lien: lienEnLigne() });
  }

  /* Dessine le QR en SVG : modules regroupés en lignes + 3 repères séparés (animables) */
  function qrSVG(info, statique) {
    var q = info.q, n = info.modules, m = 4, t = n + m * 2;
    function repere(r, c) { return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7); }
    var d = "";
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (q.isDark(r, c) && !repere(r, c)) {
          var debut = c;
          while (c < n && q.isDark(r, c) && !repere(r, c)) c++;
          d += "M" + (debut + m) + " " + (r + m) + "h" + (c - debut) + "v1h-" + (c - debut) + "z";
        } else c++;
      }
    }
    function chemin(x, y) {
      x += m; y += m;
      return "M" + x + " " + y + "h7v7h-7zM" + (x + 1) + " " + (y + 1) + "v5h5v-5zM" + (x + 2) + " " + (y + 2) + "h3v3h-3z";
    }
    var cls = statique ? "" : ' class="qr-finder"';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" shape-rendering="crispEdges" role="img" aria-label="QR code de ' + esc(nomComplet()) + '">' +
      '<rect width="' + t + '" height="' + t + '" fill="#FFFFFF"/>' +
      '<path' + (statique ? "" : ' class="qr-data"') + ' fill="#000000" d="' + d + '"/>' +
      '<path' + cls + ' fill="#062B36" fill-rule="evenodd" d="' + chemin(0, 0) + '"/>' +
      '<path' + cls + ' fill="#062B36" fill-rule="evenodd" d="' + chemin(n - 7, 0) + '"/>' +
      '<path' + cls + ' fill="#062B36" fill-rule="evenodd" d="' + chemin(0, n - 7) + '"/>' +
      "</svg>";
    return svg;
  }

  /* Animation d'apparition du QR : repères qui « éclosent », puis données + balayage */
  function animerQR(boite) {
    var niv = anim();
    if (niv === "reduit" || !boite) return;
    var sp = niv === "spectaculaire";
    $$(".qr-finder", boite).forEach(function (f, i) {
      f.animate([{ opacity: 0, transform: sp ? "scale(0) rotate(-90deg)" : "scale(.6)" }, { opacity: 1, transform: "none" }],
        { duration: sp ? 560 : 320, delay: i * (sp ? 110 : 60), easing: RESSORT, fill: "backwards" });
    });
    var data = $(".qr-data", boite);
    if (data) data.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }],
      { duration: sp ? 620 : 360, delay: sp ? 260 : 120, easing: EASE, fill: "backwards" });
    var b = $(".qr-balayage", boite);
    if (b && sp) b.animate([{ transform: "translateY(-110%)", opacity: 1 }, { transform: "translateY(380%)", opacity: 0 }],
      { duration: 1100, delay: 380, easing: "cubic-bezier(.45,0,.2,1)" });
  }

  function remplirQR(boite, mode) {
    var info = fabriquerQR(texteQR(mode));
    var balayage = '<div class="qr-balayage" aria-hidden="true"></div>';
    if (!info) {
      boite.innerHTML = '<p style="color:#7F1D1D;padding:20px;text-align:center">Le texte est trop long pour un QR. Raccourcis le texte du CV dans Paramètres ou choisis « Essentiel ».</p>';
      return null;
    }
    boite.innerHTML = qrSVG(info) + balayage;
    return info;
  }

  /* ------------------------------------------------------------------
     4. ANIMATIONS GÉNÉRIQUES
     ------------------------------------------------------------------ */
  /* Apparition en cascade des éléments marqués [data-cascade] */
  function cascade(racine, base) {
    var niv = anim();
    if (niv === "reduit") return;
    var sp = niv === "spectaculaire";
    $$("[data-cascade] > *:not([data-cascade])", racine).forEach(function (el, i) {
      el.animate([{ opacity: 0, transform: sp ? "translateY(18px) scale(.97)" : "translateY(8px)" }, { opacity: 1, transform: "none" }],
        { duration: sp ? 560 : 340, delay: (base || 0) + i * (sp ? 55 : 30), easing: EASE, fill: "backwards" });
    });
  }

  /* Révélation douce au défilement */
  var observateur = "IntersectionObserver" in window ? new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("visible"); observateur.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;

  function observerRevele(racine) {
    $$(".revele", racine).forEach(function (el, i) {
      if (!observateur || anim() === "reduit") { el.classList.add("visible"); return; }
      el.style.transitionDelay = i < 3 ? i * 90 + "ms" : "0ms";
      observateur.observe(el);
    });
  }

  /* Onde au toucher sur les boutons */
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".btn");
    if (!b || anim() === "reduit") return;
    var r = b.getBoundingClientRect(), taille = Math.max(r.width, r.height) * 2;
    var o = document.createElement("span");
    o.className = "onde";
    o.style.width = o.style.height = taille + "px";
    o.style.left = e.clientX - r.left - taille / 2 + "px";
    o.style.top = e.clientY - r.top - taille / 2 + "px";
    b.appendChild(o);
    apres(o.animate([{ transform: "scale(0)", opacity: 0.28 }, { transform: "scale(1)", opacity: 0 }], { duration: 520, easing: EASE }), 520, function () { o.remove(); });
  });

  var minuteurToast;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("visible");
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(function () { t.classList.remove("visible"); }, 2400);
  }

  /* ------------------------------------------------------------------
     5. SPLASH D'OUVERTURE (≈ 2,7 s en spectaculaire, bouton « Passer »)
     ------------------------------------------------------------------ */
  function lancerSplash() {
    return new Promise(function (resoudre) {
      var splash = $("#splash");
      var niv = anim(), sp = niv === "spectaculaire";
      var anims = [], fini = false;
      var nomEl = $(".splash-nom");
      nomEl.innerHTML = Array.from(nomComplet()).map(function (ch) { return "<span>" + esc(ch) + "</span>"; }).join("");

      function A(el, kf, o) { var a = el.animate(kf, Object.assign({ fill: "both" }, o)); anims.push(a); return a; }

      function terminer(naturel) {
        if (fini) return;
        fini = true;
        if (!naturel) anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* rien */ } });
        var duree = niv === "reduit" ? 150 : 380;
        var a = splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duree, easing: "ease-out", fill: "forwards" });
        splash.style.pointerEvents = "none";
        apres(a, duree, function () { splash.remove(); });
        resoudre();
      }
      $(".splash-passer").addEventListener("click", function () { terminer(false); });

      if (niv === "reduit") {
        $$(".splash-lettres b, .splash-nom span, .splash-sous, .splash-anneau, .splash-point").forEach(function (el) { el.style.opacity = 1; });
        setTimeout(function () { terminer(true); }, 900);
        return;
      }

      A($(".splash-anneau"), [{ opacity: 0, transform: "scale(.3) rotate(-220deg)" }, { opacity: 1, transform: "none" }], { duration: sp ? 900 : 600, easing: RESSORT });
      A($(".splash-point"), [{ opacity: 0, transform: "translate(54px,54px) scale(0)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: sp ? 480 : 300, easing: RESSORT });
      $$(".splash-lettres b").forEach(function (b, i) {
        A(b, [{ opacity: 0, transform: "translateY(40px) scale(.5) rotate(-12deg)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: (sp ? 240 : 150) + i * 110, easing: RESSORT });
      });

      if (sp) {
        /* Éclats verts/cyan qui jaillissent du logo */
        var zone = $(".splash-particules"), couleurs = ["#67E8F9", "#4ADE80", "#FFFFFF", "#22D3EE"];
        for (var i = 0; i < 18; i++) {
          var p = document.createElement("i");
          p.style.background = couleurs[i % 4];
          zone.appendChild(p);
          var ang = (i / 18) * Math.PI * 2 + Math.random() * 0.3, dist = 110 + Math.random() * 70;
          var x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
          A(p, [
            { opacity: 0, transform: "translate(0,0) scale(.2)" },
            { opacity: 1, transform: "translate(" + x * 0.45 + "px," + y * 0.45 + "px) scale(1.25)", offset: 0.25 },
            { opacity: 0, transform: "translate(" + x + "px," + y + "px) scale(.3)" }
          ], { duration: 1150, delay: 560 + Math.random() * 140, easing: "cubic-bezier(.1,.7,.3,1)" });
        }
      }

      $$(".splash-nom span").forEach(function (s, i) {
        A(s, [{ opacity: 0, transform: "translateY(110%)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: (sp ? 880 : 560) + i * (sp ? 30 : 18), easing: EASE });
      });
      A($(".splash-sous"), [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: sp ? 1450 : 950, easing: EASE });

      setTimeout(function () {
        if (fini) return;
        A($(".splash-scene"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.12)" }], { duration: 420, easing: "cubic-bezier(.4,0,1,1)" });
        setTimeout(function () { terminer(true); }, 240);
      }, sp ? 2100 : 1350);
    });
  }

  /* Entrée de la carte juste après le splash */
  function entreeCarte() {
    var scene = $(".carte-invite");
    var niv = anim();
    if (!scene || niv === "reduit") return;
    var sp = niv === "spectaculaire";
    scene.animate([{ opacity: 0, transform: sp ? "translateY(90px) rotateX(35deg) rotateZ(-6deg) scale(.85)" : "translateY(20px)" }, { opacity: 1, transform: "none" }],
      { duration: sp ? 950 : 450, easing: "cubic-bezier(.2,.9,.25,1.08)", fill: "backwards" });
    var photo = $(".recto-photo", scene);
    if (photo && sp) photo.animate([{ opacity: 0, transform: "scale(.4) rotate(-20deg)" }, { opacity: 1, transform: "none" }], { duration: 750, delay: 250, easing: RESSORT, fill: "backwards" });
    cascade($("#vue-carte"), sp ? 330 : 100);
    setTimeout(function () { reflet($(".face-recto")); }, sp ? 900 : 400);
  }

  function reflet(face) {
    if (!face || anim() !== "spectaculaire") return;
    face.classList.remove("reflet");
    void face.offsetWidth; // relance l'animation CSS
    face.classList.add("reflet");
  }

  /* ------------------------------------------------------------------
     6. NAVIGATION ENTRE ÉCRANS (glissement directionnel)
     ------------------------------------------------------------------ */
  function majTabbar() {
    var boutons = $$(".tabbar button").filter(function (b) { return b.offsetParent !== null; });
    var index = -1;
    boutons.forEach(function (b, i) {
      var actif = b.dataset.vue === vueActive;
      if (actif) { b.setAttribute("aria-current", "page"); index = i; } else b.removeAttribute("aria-current");
    });
    var ind = $(".tab-indicateur");
    ind.style.opacity = index < 0 ? 0 : 1;
    if (index >= 0) ind.style.transform = "translateX(" + index * 100 + "%)";
  }

  function aller(nom) {
    if (nom === vueActive) return;
    var ancienne = $("#vue-" + vueActive), nouvelle = $("#vue-" + nom);
    if (!nouvelle) return;
    var dir = ORDRE.indexOf(nom) > ORDRE.indexOf(vueActive) ? 1 : -1;
    if (vueActive === "scanner") Scanner.arreter();
    if (nom !== "reglages") vuePrecedente = nom;
    vueActive = nom;
    preparerVue(nom);
    majTabbar();
    $("#titre-vue").textContent = nouvelle.dataset.titre;
    $("#btn-retour").hidden = nom !== "reglages";
    $("#btn-reglages").hidden = nom === "reglages" || VISITEUR;

    var niv = anim();
    function montrer() {
      if (vueActive !== nom) return; // un autre onglet a été choisi entre-temps
      $$(".vue").forEach(function (v) { v.hidden = v !== nouvelle; });
      window.scrollTo(0, 0);
      if (niv !== "reduit") {
        nouvelle.animate([{ opacity: 0, transform: "translateX(" + dir * (niv === "spectaculaire" ? 48 : 20) + "px)" }, { opacity: 1, transform: "none" }],
          { duration: niv === "spectaculaire" ? 380 : 260, easing: EASE });
        cascade(nouvelle, 60);
      }
      observerRevele(nouvelle);
      apresAffichage(nom);
    }
    if (niv === "reduit") { montrer(); return; }
    var a = ancienne.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + -dir * 24 + "px) scale(.985)" }],
      { duration: 150, easing: "cubic-bezier(.4,0,1,1)" });
    apres(a, 150, montrer);
  }

  /* Rendu à jour avant affichage */
  function preparerVue(nom) {
    if (nom === "carte") rendreCarte();
    else if (nom === "profil") rendreProfil();
    else if (nom === "qr") rendreQR();
    else if (nom === "carnet") rendreCarnet();
    else if (nom === "reglages") rendreReglages();
  }
  function apresAffichage(nom) {
    if (nom === "qr") animerQR($("#qr-principal"));
  }

  /* ------------------------------------------------------------------
     7. ÉCRAN « MA CARTE » (recto infos / verso QR)
     ------------------------------------------------------------------ */
  function ligneContact(ic, libelle, valeur, href, externe) {
    if (!valeur) return "";
    var contenu = "<small>" + esc(libelle) + "</small><strong>" + esc(valeur) + "</strong>";
    var lien = href
      ? '<a href="' + esc(href) + '"' + (externe ? ' target="_blank" rel="noopener"' : "") + ">" + contenu + "</a>"
      : '<span class="contact-txt">' + contenu + "</span>";
    return '<li class="contact"><span class="contact-icone">' + icone(ic) + "</span>" + lien +
      '<button class="copier" type="button" data-action="copier" data-valeur="' + esc(valeur) + '" aria-label="Copier : ' + esc(libelle) + '">' +
      icone("copy", "ic-copie") + icone("check", "ic-ok") + "</button></li>";
  }

  /* Petite carte de visite (format bancaire) : on la touche, elle se retourne
     en pivotant d'un quart de tour et s'agrandit pour montrer le QR en grand. */
  function rendreCarte() {
    var p = profil;
    var lignes = [
      p.telephone ? "<li>" + icone("phone") + esc(p.telephone) + "</li>" : "",
      p.email ? "<li>" + icone("mail") + esc(p.email) + "</li>" : "",
      (p.ville || p.pays) ? "<li>" + icone("pin") + esc([p.ville, p.pays].filter(Boolean).join(", ")) + "</li>" : ""
    ].join("");
    var recto =
      '<div class="face face-recto">' +
        '<span class="recto-cercle" aria-hidden="true"></span><span class="recto-halo" aria-hidden="true"></span>' +
        '<span class="recto-logo" aria-hidden="true">MOC</span>' +
        '<div class="recto-haut">' +
          '<div class="recto-photo"><span class="orbite" aria-hidden="true"></span><img src="' + esc(photoSrc()) + '" alt="" decoding="async"></div>' +
          '<div class="recto-id"><h2 class="carte-nom">' + esc(nomComplet()) + "</h2>" +
            '<p class="carte-titre">' + esc(p.titre) + "</p>" +
            (p.organisation ? '<span class="recto-org">' + icone("grad") + esc(p.organisation) + "</span>" : "") +
          "</div>" +
        "</div>" +
        '<ul class="recto-contacts">' + lignes + "</ul>" +
      "</div>";
    var verso =
      '<div class="face face-verso" aria-hidden="true">' +
        '<div class="verso-bande verso-bande-g"><span>Scanne-moi</span></div>' +
        '<div class="verso-qr" id="qr-verso"></div>' +
        '<div class="verso-bande verso-bande-d"><span>' + esc(nomComplet()) + "<br>Appareil photo · sans internet</span></div>" +
      "</div>";
    var ronds = [
      p.telephone ? '<a class="rond" href="tel:' + esc(VCard.telCompact(p.telephone)) + '"><span>' + icone("phone") + "</span>Appeler</a>" : "",
      p.whatsapp ? '<a class="rond" href="' + esc(VCard.lienWhatsApp(p.whatsapp)) + '" target="_blank" rel="noopener"><span>' + icone("chat") + "</span>WhatsApp</a>" : "",
      p.email ? '<a class="rond" href="mailto:' + esc(p.email) + '"><span>' + icone("mail") + "</span>Email</a>" : ""
    ].join("");
    $("#vue-carte").innerHTML =
      '<div class="scene-carte">' +
        '<div class="carte-invite">' +
          '<div class="carte3d" id="carte3d" role="button" tabindex="0" aria-pressed="false" aria-label="Carte de visite de ' + esc(nomComplet()) + '. Touchez pour afficher le QR code.">' + recto + verso + "</div>" +
        "</div>" +
        '<div class="carte-sous" data-cascade>' +
          '<p class="indice"><span class="indice-main" aria-hidden="true"><span class="tap-onde"></span><span class="tap-onde d2"></span>' + icone("tap") + "</span>Touche la carte pour voir mon QR</p>" +
          '<div class="ronds">' + ronds + "</div>" +
          '<div class="btn-ligne">' +
            '<button class="btn btn-primaire" type="button" data-action="vcf">' + icone("user-plus") + "Enregistrer</button>" +
            '<button class="btn" type="button" data-action="voir-profil">' + icone("user") + "Profil complet</button>" +
          "</div>" +
          '<button class="btn btn-plein btn-partager" type="button" data-action="partager">' + icone("share") + "Partager l'appli</button>" +
        "</div>" +
      "</div>" +
      '<div class="dos-actions">' +
        "<p>Scanne avec l'appareil photo · touche le QR pour retourner la carte</p>" +
        '<button class="btn btn-primaire" type="button" data-action="plein">' + icone("expand") + "QR en plein écran</button>" +
      "</div>";
    remplirQR($("#qr-verso"));
    dimensionnerCarte();
  }

  /* Calcule la taille de la carte et l'agrandissement du verso selon l'écran */
  function dimensionnerCarte() {
    var scene = $(".scene-carte");
    if (!scene) return;
    var cont = Math.max(260, Math.min($("#vues").clientWidth - 32, 528));
    var W = Math.min(cont, 400), H = Math.round(W / 1.586);
    var zone = Math.round(Math.max(window.innerHeight - 56 - 68 - 150, W * 1.45));
    var s = Math.min(cont / H, (zone - 12) / W);
    var dy = -Math.round(zone / 2 - H / 2 - 12);
    scene.style.setProperty("--w", W + "px");
    scene.style.setProperty("--h", H + "px");
    scene.style.setProperty("--s", s.toFixed(3));
    scene.style.setProperty("--dy", dy + "px");
    scene.style.setProperty("--zone", zone + "px");
    scene.style.setProperty("--top-sous", 12 + H + 22 + "px");
  }
  window.addEventListener("resize", function () { dimensionnerCarte(); });

  function retournerCarte() {
    var c = $("#carte3d");
    if (!c) return;
    var retournee = c.classList.toggle("retournee");
    $(".scene-carte").classList.toggle("retournee", retournee);
    c.setAttribute("aria-pressed", String(retournee));
    c.setAttribute("aria-label", retournee ? "QR code de la carte. Touchez pour revenir aux informations." : "Carte de visite de " + nomComplet() + ". Touchez pour afficher le QR code.");
    $(".face-recto", c).setAttribute("aria-hidden", String(retournee));
    $(".face-verso", c).setAttribute("aria-hidden", String(!retournee));
    vibrer(12);
    var duree = anim() === "reduit" ? 0 : anim() === "sobre" ? 320 : 520;
    setTimeout(function () {
      if (retournee) animerQR($("#qr-verso"));
      reflet(retournee ? $(".face-verso", c) : $(".face-recto", c));
    }, duree);
  }

  /* Toucher la carte (ou Entrée / Espace au clavier) la retourne */
  document.addEventListener("click", function (e) { if (e.target.closest("#carte3d")) retournerCarte(); });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && document.activeElement && document.activeElement.id === "carte3d") { e.preventDefault(); retournerCarte(); }
  });

  /* ------------------------------------------------------------------
     8. ÉCRAN « PROFIL COMPLET » (hors ligne)
     ------------------------------------------------------------------ */
  function section(ic, titre, contenu, vert) {
    return '<section class="section revele"><div class="section-titre"><span class="section-icone' + (vert ? " vert" : "") + '">' + icone(ic) + "</span><h3>" + esc(titre) + "</h3></div>" + contenu + "</section>";
  }
  function frise(items) {
    return '<ul class="frise">' + (items || []).map(function (it) {
      return "<li><h4>" + esc(it.t) + "</h4>" + (it.s ? '<p class="sous">' + esc(it.s) + "</p>" : "") + (it.d ? "<p>" + esc(it.d) + "</p>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  function rendreProfil() {
    var p = profil;
    var comp = '<div class="grille-comp">' + (p.competences || []).map(function (c) {
      return '<div class="comp"><strong>' + esc(c.t) + "</strong>" + (c.d ? "<span>" + esc(c.d) + "</span>" : "") + "</div>";
    }).join("") + "</div>";
    var langues = (p.langues || []).map(function (l) {
      var n = Math.max(0, Math.min(1, Number(l.niveau) || 0.5));
      return '<div class="langue"><div class="langue-tete"><strong>' + esc(l.t) + "</strong><span>" + esc(l.d) + '</span></div><div class="jauge" role="img" aria-label="Niveau ' + Math.round(n * 100) + ' %"><i style="--niveau:' + n + '"></i></div></div>';
    }).join("");
    var interets = '<ul class="liste-simple">' + (p.interets || []).map(function (it) {
      return "<li><div><strong>" + esc(it.t) + "</strong>" + (it.d ? "<span>" + esc(it.d) + "</span>" : "") + "</div></li>";
    }).join("") + "</ul>";

    $("#vue-profil").innerHTML =
      '<div class="profil-tete" data-cascade><img src="' + esc(photoSrc()) + '" alt="" width="72" height="72"><div><h2>' + esc(nomComplet()) + "</h2><p>" + esc(p.titre) + (p.organisation ? " · " + esc(p.organisation) : "") + "</p></div></div>" +
      section("phone", "Coordonnées", '<ul class="contacts" style="margin:0">' +
        ligneContact("phone", "Téléphone", p.telephone, "tel:" + VCard.telCompact(p.telephone)) +
        ligneContact("chat", "WhatsApp", p.whatsapp, VCard.lienWhatsApp(p.whatsapp), true) +
        ligneContact("mail", "Email", p.email, "mailto:" + p.email) +
        ligneContact("pin", "Ville", [p.ville, p.pays].filter(Boolean).join(", "), "") + "</ul>") +
      (p.objectif ? section("target", "Objectif", '<p class="txt">' + esc(p.objectif) + "</p>", true) : "") +
      (p.resume ? section("user", "Profil", '<p class="txt">' + esc(p.resume) + "</p>") : "") +
      ((p.formation || []).length ? section("grad", "Formation", frise(p.formation)) : "") +
      ((p.projets || []).length ? section("leaf", "Projets et initiatives", frise(p.projets), true) : "") +
      ((p.competences || []).length ? section("star", "Compétences", comp) : "") +
      ((p.langues || []).length ? section("globe", "Langues", langues) : "") +
      ((p.interets || []).length ? section("heart", "Centres d'intérêt", interets, true) : "") +
      '<div class="revele" style="margin-top:6px"><button class="btn btn-primaire btn-plein" type="button" data-action="vcf">' + icone("user-plus") + "Enregistrer le contact</button></div>";
  }

  /* ------------------------------------------------------------------
     9. ÉCRAN « MON QR » (densité, exports)
     ------------------------------------------------------------------ */
  function segment(nom, options, valeur, libelle) {
    var i = Math.max(0, options.findIndex(function (o) { return o[0] === valeur; }));
    var n = options.length;
    return '<div class="segment" role="group" aria-label="' + esc(libelle) + '" data-segment="' + nom + '">' +
      '<span class="segment-curseur" aria-hidden="true" style="width:calc((100% - ' + (8 + 4 * (n - 1)) + "px) / " + n + ");transform:translateX(calc(" + i * 100 + "% + " + i * 4 + 'px))"></span>' +
      options.map(function (o) { return '<button type="button" data-valeur="' + o[0] + '" aria-pressed="' + (o[0] === valeur) + '">' + esc(o[1]) + "</button>"; }).join("") +
      "</div>";
  }

  function evaluerDensite(info) {
    var o = info.octets, etat;
    if (o <= 500) etat = ["ok", "Très facile à scanner"];
    else if (o <= 1000) etat = ["moyen", "Facile à scanner sur écran"];
    else if (o <= 1500) etat = ["dense", "Dense : affiche-le en grand"];
    else etat = ["trop", "Très dense : raccourcis le texte"];
    var cm = ((info.modules + 8) * 0.4 / 10).toFixed(1).replace(".", ",");
    return { classe: etat[0], libelle: etat[1], niveau: Math.min(1, o / 2000), cm: cm };
  }

  function rendreQR() {
    var lien = lienEnLigne();
    $("#vue-qr").innerHTML =
      '<div class="vue-entete" data-cascade><h2>Mon QR code</h2><p>Lisible par n\'importe quel téléphone, sans internet et sans application.</p></div>' +
      '<div class="qr-grand" data-cascade>' +
        segment("qrMode", [["complet", "Contact + CV"], ["essentiel", "Essentiel"]], reglages.qrMode, "Contenu du QR") +
        '<div style="height:14px"></div>' +
        '<div class="qr-cadre" id="qr-principal"></div>' +
        '<div class="densite" id="densite"></div>' +
        '<div class="grille-actions">' +
          '<button class="btn btn-primaire" type="button" data-action="plein" style="grid-column:1/-1">' + icone("expand") + "Afficher en plein écran</button>" +
          '<button class="btn" type="button" data-action="png">' + icone("download") + "PNG</button>" +
          '<button class="btn" type="button" data-action="svg">' + icone("download") + "SVG</button>" +
          '<button class="btn" type="button" data-action="vcf">' + icone("file") + "Fichier .vcf</button>" +
          '<button class="btn" type="button" data-action="image">' + icone("image") + "Image à partager</button>" +
        "</div>" +
        '<p class="note-info">' + icone("link") + "<span>" + (lien
          ? "Le QR contient aussi le lien vers ta carte animée en ligne : <strong>" + esc(lien.replace(/#v$/, "")) + "</strong>"
          : "Le lien vers ta carte animée en ligne sera ajouté automatiquement dès que l'appli sera publiée sur GitHub Pages.") + "</span></p>" +
        '<p class="note-info">' + icone("sun") + "<span>Pour un scan facile : luminosité au maximum, QR bien à plat, à 15–25 cm de l'appareil photo.</span></p>" +
      "</div>";
    var info = remplirQR($("#qr-principal"));
    majDensite(info);
  }

  function majDensite(info) {
    var boite = $("#densite");
    if (!boite) return;
    if (!info) { boite.innerHTML = '<div class="densite-tete"><strong>Capacité dépassée</strong><span class="badge trop">Trop long</span></div>'; return; }
    var d = evaluerDensite(info);
    boite.innerHTML =
      '<div class="densite-tete"><strong>Densité du QR</strong><span class="badge ' + d.classe + '">' + d.libelle + "</span></div>" +
      '<div class="jauge"><i style="--niveau:' + d.niveau + '"></i></div>' +
      "<small>" + info.octets.toLocaleString("fr-FR") + " octets · version " + info.version + " · " + info.modules + "×" + info.modules + " carrés · correction " + info.ecc +
      "<br>À imprimer : au moins " + d.cm + " cm de côté.</small>";
  }

  /* QR en plein écran, fond blanc, écran maintenu allumé */
  var verrouEcran = null;
  var AIDE_PLEIN = "Monte la luminosité au maximum · Touchez pour fermer";
  /* Sans paramètre : QR de la carte (vCard). Avec : QR d'un autre texte (ex. invitation au site). */
  function ouvrirPleinEcran(texte, titre, aide) {
    var info = fabriquerQR(texte || texteQR());
    if (!info) { toast("QR trop long : choisis « Essentiel »."); return; }
    var o = $("#qr-plein");
    $(".qr-plein-boite", o).innerHTML = qrSVG(info);
    $(".qr-plein-nom", o).textContent = titre || nomComplet();
    $(".qr-plein-aide", o).textContent = aide || AIDE_PLEIN;
    o.hidden = false;
    if (anim() !== "reduit") {
      o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
      $(".qr-plein-boite", o).animate([{ transform: "scale(.85)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 480, easing: RESSORT });
      animerQR(o);
    }
    try { if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(function (v) { verrouEcran = v; }).catch(function () {}); } catch (e) { /* rien */ }
    ouvrirModal(function () {
      var fin = function () { o.hidden = true; };
      if (anim() === "reduit") fin();
      else apres(o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }), 180, fin);
      if (verrouEcran) { verrouEcran.release().catch(function () {}); verrouEcran = null; }
    });
    $(".qr-plein-fermer", o).focus();
  }

  /* ------------------------------------------------------------------
     9 bis. PARTAGER L'APPLI : inviter quelqu'un à découvrir la carte
     ------------------------------------------------------------------ */
  var LIEN_PUBLIC = "https://papimoryoumarcamara-web.github.io/Moryvisitecard/#v";
  function lienInvitation() { return lienEnLigne() || LIEN_PUBLIC; }
  function texteInvitation() {
    return "Salut ! Découvre la carte de visite numérique de " + nomComplet() +
      (profil.titre ? " – " + profil.titre + (profil.organisation ? ", " + profil.organisation : "") : "") +
      ".\nCarte animée, QR code à scanner et contact à enregistrer. Elle s'installe comme une appli et marche même sans internet.\n\n" +
      "Voir la carte : " + lienInvitation();
  }
  function optionPartage(action, ic, titre, detail) {
    return '<button class="option-partage" type="button" data-action="' + action + '"><span class="option-ic">' + icone(ic) +
      "</span><span><strong>" + esc(titre) + "</strong><small>" + esc(detail) + "</small></span></button>";
  }
  function ouvrirPartage() {
    vibrer(10);
    ouvrirFeuille('<div data-cascade>' +
      '<h2 id="feuille-titre" class="partage-titre">Partager l\'appli</h2>' +
      '<p class="partage-aide">Invite tes amis à découvrir ta carte et à l\'installer.</p>' +
      '<div class="options-partage">' +
        optionPartage("partage-invitation", "share", "Envoyer une invitation", "Message avec le lien de la carte (WhatsApp, SMS…)") +
        optionPartage("partage-qr", "qr", "Montrer le QR du site", "Une personne à côté de toi le scanne pour ouvrir la carte") +
        optionPartage("partage-copier", "copy", "Copier le lien", "Pour le coller où tu veux") +
      "</div>" +
      '<button class="btn btn-plein" type="button" data-action="fermer-feuille">Fermer</button>' +
    "</div>");
  }
  function envoyerInvitation() {
    var texte = texteInvitation(), titre = "Carte de visite de " + nomComplet();
    var whatsapp = function () { window.open("https://wa.me/?text=" + encodeURIComponent(texte), "_blank"); };
    if (navigator.share) navigator.share({ title: titre, text: texte }).catch(function (e) { if (e && e.name !== "AbortError") whatsapp(); });
    else whatsapp();
  }

  /* ------------------------------------------------------------------
     10. EXPORTS (PNG, SVG, .vcf, image partageable)
     ------------------------------------------------------------------ */
  function telecharger(blob, nom) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function partagerOuTelecharger(blob, nom, titre) {
    if (tactile && navigator.canShare) {
      var f = new File([blob], nom, { type: blob.type });
      if (navigator.canShare({ files: [f] })) {
        return navigator.share({ files: [f], title: titre }).catch(function (e) {
          if (e && e.name !== "AbortError") { telecharger(blob, nom); toast("Fichier enregistré : " + nom); }
        });
      }
    }
    telecharger(blob, nom);
    toast("Fichier enregistré : " + nom);
    return Promise.resolve();
  }

  function chargerImage(src) {
    return new Promise(function (ok, ko) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = ko;
      img.src = src;
    });
  }

  function exporterPNG() {
    var info = fabriquerQR(texteQR());
    if (!info) return toast("QR trop long.");
    var n = info.modules, m = 4, s = Math.max(8, Math.floor(1400 / (n + m * 2))), t = (n + m * 2) * s;
    var cv = document.createElement("canvas");
    cv.width = cv.height = t;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, t, t);
    ctx.fillStyle = "#000000";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (info.q.isDark(r, c)) ctx.fillRect((c + m) * s, (r + m) * s, s, s);
    cv.toBlob(function (b) { partagerOuTelecharger(b, "QR-" + slug() + ".png", "Mon QR code"); }, "image/png");
  }

  function exporterSVG() {
    var info = fabriquerQR(texteQR());
    if (!info) return toast("QR trop long.");
    var svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + qrSVG(info, true);
    telecharger(new Blob([svg], { type: "image/svg+xml" }), "QR-" + slug() + ".svg");
    toast("Fichier enregistré : QR-" + slug() + ".svg");
  }

  /* Photo réduite (200 px) en base64 pour le fichier .vcf */
  function photoBase64() {
    return chargerImage(profil.photo || "assets/photo-vcf.jpg").then(function (img) {
      var cv = document.createElement("canvas"), t = 200;
      cv.width = cv.height = t;
      var cote = Math.min(img.naturalWidth, img.naturalHeight);
      cv.getContext("2d").drawImage(img, (img.naturalWidth - cote) / 2, (img.naturalHeight - cote) / 2, cote, cote, 0, 0, t, t);
      return cv.toDataURL("image/jpeg", 0.75).split(",")[1];
    }).catch(function () { return ""; });
  }

  function exporterVCF() {
    vibrer(15);
    photoBase64().then(function (b64) {
      var texte = VCard.construire(profil, { mode: "fichier", lien: lienEnLigne(), photoBase64: b64 });
      var blob = new Blob([texte], { type: "text/vcard;charset=utf-8" });
      var nom = slug() + ".vcf";
      if (estIOS && estInstallee() && navigator.canShare && navigator.canShare({ files: [new File([blob], nom, { type: blob.type })] })) {
        // Appli installée sur iPhone : la feuille de partage permet d'ouvrir le contact
        partagerOuTelecharger(blob, nom, nomComplet());
      } else if (estIOS) {
        // Dans Safari, ouvrir le fichier affiche directement « Créer un contact »
        var url = URL.createObjectURL(blob);
        window.location.href = url;
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      } else {
        telecharger(blob, nom);
        toast("Contact téléchargé : ouvre " + nom + " pour l'ajouter");
      }
    });
  }

  /* Image 1080×1350 prête à partager (WhatsApp, statut, réseaux) */
  function exporterImage() {
    var info = fabriquerQR(texteQR());
    if (!info) return toast("QR trop long.");
    toast("Création de l'image…");
    var W = 1080, H = 1350;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    Promise.all([
      document.fonts ? document.fonts.load('600 60px "Outfit"') : null,
      document.fonts ? document.fonts.load('500 30px "Work Sans"') : null,
      chargerImage(photoSrc())
    ]).then(function (res) {
      var img = res[2];
      var g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0E7490"); g.addColorStop(0.5, "#0B5A70"); g.addColorStop(1, "#062B36");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // Décor : halo vert + cercles pointillés
      var halo = ctx.createRadialGradient(140, 1250, 0, 140, 1250, 420);
      halo.addColorStop(0, "rgba(74,222,128,.35)"); halo.addColorStop(1, "rgba(74,222,128,0)");
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      ctx.setLineDash([10, 14]); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(103,232,249,.35)";
      ctx.beginPath(); ctx.arc(980, 60, 300, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Photo ronde + orbite
      var cx = W / 2, cy = 215, R = 120;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      var cote = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - cote) / 2, (img.naturalHeight - cote) / 2, cote, cote, cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      ctx.lineWidth = 8; ctx.strokeStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = "#67E8F9"; ctx.beginPath(); ctx.arc(cx, cy, R + 22, -Math.PI * 0.95, -Math.PI * 0.05); ctx.stroke();
      ctx.fillStyle = "#4ADE80"; ctx.beginPath(); ctx.arc(cx + Math.cos(-Math.PI * 0.05) * (R + 22), cy + Math.sin(-Math.PI * 0.05) * (R + 22), 12, 0, Math.PI * 2); ctx.fill();
      // Textes
      ctx.textAlign = "center"; ctx.fillStyle = "#FFFFFF";
      ctx.font = '600 62px "Outfit", sans-serif';
      ctx.fillText(nomComplet(), cx, 432);
      ctx.fillStyle = "#CFFAFE"; ctx.font = '500 32px "Work Sans", sans-serif';
      ctx.fillText(profil.titre, cx, 484);
      if (profil.organisation) { ctx.fillStyle = "#A5F3FC"; ctx.font = '600 30px "Work Sans", sans-serif'; ctx.fillText(profil.organisation, cx, 530); }
      // QR sur fond blanc arrondi
      var bx = 235, by = 572, bt = 610;
      ctx.fillStyle = "#FFFFFF"; arrondi(ctx, bx, by, bt, bt, 40); ctx.fill();
      var n = info.modules, marge = 26, s = (bt - marge * 2) / n;
      ctx.fillStyle = "#000000";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (info.q.isDark(r, c)) ctx.fillRect(bx + marge + c * s, by + marge + r * s, Math.ceil(s), Math.ceil(s));
      ctx.fillStyle = "#E8F8FB"; ctx.font = '500 30px "Work Sans", sans-serif';
      ctx.fillText("Scanne avec l'appareil photo pour m'ajouter", cx, 1248);
      ctx.fillStyle = "#A5F3FC"; ctx.font = '500 27px "Work Sans", sans-serif';
      ctx.fillText([profil.telephone, profil.email].filter(Boolean).join("  ·  "), cx, 1300);
      cv.toBlob(function (b) { partagerOuTelecharger(b, "Carte-" + slug() + ".png", nomComplet()); }, "image/png");
    }).catch(function () { toast("Impossible de créer l'image."); });
  }
  function arrondi(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ------------------------------------------------------------------
     11. SCANNER INTÉGRÉ (caméra, hors ligne : BarcodeDetector ou jsQR)
     ------------------------------------------------------------------ */
  var Scanner = {
    flux: null, actif: false, raf: 0, dernier: 0, occupe: false, detecteur: null,
    canvas: document.createElement("canvas"),

    rendre: function () {
      $("#vue-scanner").innerHTML =
        '<div class="vue-entete" data-cascade><h2>Scanner une carte</h2><p>Lis le QR code d\'une autre personne, même hors ligne.</p></div>' +
        '<div class="scanner-zone" id="scan-zone">' +
          '<video id="scan-video" playsinline muted autoplay></video>' +
          '<div class="viseur" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="laser"></span></div>' +
          '<div class="scanner-repos" id="scan-repos">' + icone("camera", "") +
            "<p>La caméra sert uniquement à lire le QR. Rien n'est envoyé sur internet.</p>" +
            '<button class="btn btn-primaire" type="button" data-action="scan-demarrer">' + icone("scan") + "Activer la caméra</button>" +
          "</div>" +
        "</div>" +
        '<p class="scanner-statut" id="scan-statut" role="status" aria-live="polite"></p>' +
        '<div class="btn-ligne"><button class="btn" type="button" data-action="scan-image">' + icone("image") + 'Depuis une image</button>' +
        '<button class="btn" type="button" data-action="scan-arreter">' + icone("x") + "Arrêter</button></div>" +
        '<input type="file" accept="image/*" id="scan-fichier" hidden>';
      var grande = $("#scan-repos .ic");
      if (grande) { grande.style.width = grande.style.height = "44px"; grande.style.color = "#67E8F9"; }
      $("#scan-fichier").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (f) Scanner.depuisImage(f);
      });
    },

    statut: function (t) { var s = $("#scan-statut"); if (s) s.textContent = t; },

    creerDetecteur: function () {
      if (!("BarcodeDetector" in window)) return Promise.resolve(null);
      return window.BarcodeDetector.getSupportedFormats().then(function (f) {
        return f.indexOf("qr_code") >= 0 ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      }).catch(function () { return null; });
    },

    demarrer: function () {
      var self = this;
      if (!window.isSecureContext) { this.statut("La caméra exige une adresse sécurisée (https). Utilise « Depuis une image »."); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.statut("Caméra indisponible ici. Utilise « Depuis une image »."); return; }
      this.statut("Ouverture de la caméra…");
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        .then(function (flux) {
          if (vueActive !== "scanner") { flux.getTracks().forEach(function (t) { t.stop(); }); return; }
          self.flux = flux;
          var v = $("#scan-video");
          v.srcObject = flux;
          return v.play().then(function () { return self.creerDetecteur(); }).then(function (d) {
            self.detecteur = d;
            self.actif = true;
            $("#scan-repos").hidden = true;
            var z = $("#scan-zone"); z.classList.remove("trouve"); z.classList.add("actif");
            self.statut("Vise le QR code, il sera lu automatiquement…");
            self.raf = requestAnimationFrame(self.boucle.bind(self));
          });
        })
        .catch(function (e) {
          self.statut(e && e.name === "NotAllowedError"
            ? "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, puis réessaie."
            : "Impossible d'ouvrir la caméra. Utilise « Depuis une image ».");
        });
    },

    arreter: function () {
      this.actif = false;
      cancelAnimationFrame(this.raf);
      if (this.flux) { this.flux.getTracks().forEach(function (t) { t.stop(); }); this.flux = null; }
      var v = $("#scan-video"); if (v) v.srcObject = null;
      var z = $("#scan-zone"); if (z) z.classList.remove("actif");
      var r = $("#scan-repos"); if (r) r.hidden = false;
    },

    boucle: function (t) {
      if (!this.actif) return;
      this.raf = requestAnimationFrame(this.boucle.bind(this));
      if (this.occupe || t - this.dernier < 150) return; // ~6 analyses/s : économise la batterie
      this.dernier = t;
      var v = $("#scan-video");
      if (!v || v.readyState < 2) return;
      var self = this;
      this.occupe = true;
      this.decoder(v, v.videoWidth, v.videoHeight, false).then(function (texte) {
        self.occupe = false;
        if (texte && self.actif) self.trouve(texte);
      }).catch(function () { self.occupe = false; });
    },

    /* Décodage : API native si disponible (Android/Chrome), sinon jsQR (iPhone, PC) */
    decoder: function (source, w, h, tout) {
      var self = this;
      var natif = this.detecteur
        ? this.detecteur.detect(source).then(function (r) { return r && r.length ? r[0].rawValue : null; }).catch(function () { return null; })
        : Promise.resolve(null);
      return natif.then(function (texte) {
        if (texte || !window.jsQR || !w || !h) return texte;
        var echelle = Math.min(1, (tout ? 1600 : 900) / Math.max(w, h));
        var cw = Math.round(w * echelle), ch = Math.round(h * echelle);
        self.canvas.width = cw; self.canvas.height = ch;
        var ctx = self.canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, cw, ch);
        var res = window.jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: tout ? "attemptBoth" : "dontInvert" });
        return res ? res.data : null;
      });
    },

    trouve: function (texte) {
      this.actif = false;
      vibrer([30, 40, 30]);
      var z = $("#scan-zone"); z.classList.remove("actif"); z.classList.add("trouve");
      this.statut("QR code lu.");
      var self = this;
      setTimeout(function () { self.arreter(); ouvrirResultat(texte); }, anim() === "reduit" ? 0 : 420);
    },

    depuisImage: function (fichier) {
      var self = this;
      this.statut("Analyse de l'image…");
      var url = URL.createObjectURL(fichier);
      chargerImage(url).then(function (img) {
        return self.creerDetecteur().then(function (d) {
          self.detecteur = d;
          return self.decoder(img, img.naturalWidth, img.naturalHeight, true);
        });
      }).then(function (texte) {
        URL.revokeObjectURL(url);
        if (texte) { self.statut("QR code lu."); vibrer(30); ouvrirResultat(texte); }
        else self.statut("Aucun QR code trouvé dans cette image.");
      }).catch(function () { URL.revokeObjectURL(url); self.statut("Image illisible."); });
    }
  };

  /* ------------------------------------------------------------------
     12. FEUILLE DU BAS + HISTORIQUE (bouton retour Android)
     ------------------------------------------------------------------ */
  var pileModales = [];
  function ouvrirModal(fermer) { pileModales.push(fermer); history.pushState({ modal: pileModales.length }, ""); }
  function demanderFermeture() { if (pileModales.length) history.back(); }
  window.addEventListener("popstate", function () { var f = pileModales.pop(); if (f) f(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") demanderFermeture(); });

  var focusAvantFeuille = null;
  function ouvrirFeuille(contenuHTML) {
    var f = $("#feuille"), p = $(".feuille-panneau", f);
    focusAvantFeuille = document.activeElement;
    $(".feuille-contenu", f).innerHTML = contenuHTML;
    f.hidden = false;
    if (anim() !== "reduit") {
      $(".feuille-fond", f).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
      p.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: anim() === "spectaculaire" ? 520 : 320, easing: "cubic-bezier(.2,1.1,.3,1)" });
      cascade(p, 120);
    }
    ouvrirModal(function () {
      var fin = function () { f.hidden = true; if (focusAvantFeuille && focusAvantFeuille.focus) focusAvantFeuille.focus(); };
      if (anim() === "reduit") return fin();
      $(".feuille-fond", f).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      apres(p.animate([{ transform: "none" }, { transform: "translateY(100%)" }], { duration: 220, easing: "cubic-bezier(.4,0,1,1)" }), 220, fin);
    });
    var premier = $("button, a", p);
    if (premier) premier.focus({ preventScroll: true });
  }

  function initiales(nom) {
    return String(nom || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (m) { return m[0]; }).join("").toUpperCase();
  }

  function ficheHTML(c, depuisCarnet) {
    var lignes = "";
    c.tels.forEach(function (t) { lignes += ligneContact("phone", "Téléphone", t, "tel:" + VCard.telCompact(t)); });
    c.emails.forEach(function (m) { lignes += ligneContact("mail", "Email", m, "mailto:" + m); });
    c.urls.forEach(function (u) { lignes += ligneContact("link", "Lien", u.replace(/^https?:\/\//, ""), /^https?:/i.test(u) ? u : "", true); });
    if (c.adresse) lignes += ligneContact("pin", "Adresse", c.adresse, "");
    var dejaGardee = carnet.some(function (x) { return x.brut === c.brut; });
    return '<div data-cascade>' +
      '<div class="fiche-tete"><span class="avatar">' + esc(initiales(c.fn)) + '</span><div><h2 id="feuille-titre">' + esc(c.fn) + "</h2><p>" + esc([c.titre, c.org].filter(Boolean).join(" · ")) + "</p></div></div>" +
      (lignes ? '<ul class="contacts fiche-lignes">' + lignes + "</ul>" : "") +
      (c.note ? '<div class="fiche-note">' + esc(c.note) + "</div>" : "") +
      '<div class="fiche-actions">' +
        (depuisCarnet || dejaGardee ? "" : '<button class="btn btn-primaire" type="button" data-action="garder">' + icone("book") + "Garder dans mon carnet</button>") +
        '<button class="btn' + (depuisCarnet || dejaGardee ? " btn-primaire" : "") + '" type="button" data-action="vers-contacts">' + icone("user-plus") + "Ajouter aux contacts du téléphone</button>" +
        (depuisCarnet ? '<button class="btn btn-danger" type="button" data-action="supprimer" data-id="' + esc(c.id) + '">' + icone("trash") + "Supprimer du carnet</button>" : "") +
        '<button class="btn" type="button" data-action="fermer-feuille">Fermer</button>' +
      "</div></div>";
  }

  var resultatCourant = null;
  function ouvrirResultat(texte) {
    var c = VCard.lire(texte);
    resultatCourant = c;
    if (c.type === "vcard") { ouvrirFeuille(ficheHTML(c, false)); return; }
    var corps = c.type === "lien"
      ? '<p class="fiche-note">' + esc(c.url) + '</p><div class="fiche-actions"><a class="btn btn-primaire" href="' + esc(c.url) + '" target="_blank" rel="noopener">' + icone("link") + "Ouvrir le lien</a>"
      : '<p class="fiche-note">' + esc(c.texte) + '</p><div class="fiche-actions">';
    ouvrirFeuille('<div data-cascade><h2 id="feuille-titre" style="margin-bottom:12px">' + (c.type === "lien" ? "Lien trouvé" : "Texte trouvé") + "</h2>" + corps +
      '<button class="btn" type="button" data-action="copier-resultat">' + icone("copy") + 'Copier</button><button class="btn" type="button" data-action="fermer-feuille">Fermer</button></div></div>');
  }

  /* ------------------------------------------------------------------
     13. CARNET DES CARTES SCANNÉES (local)
     ------------------------------------------------------------------ */
  function sauverCarnet() { if (!Stock.ecrire(CLE_CARNET, carnet)) toast("Stockage plein : impossible d'enregistrer."); }

  function rendreCarnet(filtre) {
    var vue = $("#vue-carnet");
    if (!carnet.length) {
      vue.innerHTML = '<div class="vue-entete" data-cascade><h2>Carnet</h2><p>Les cartes que tu scannes restent sur ton téléphone.</p></div>' +
        '<div class="vide" data-cascade><span class="avatar">' + icone("book") + '</span><h3>Scanne ta première carte</h3><p>Le QR d\'un contact s\'enregistre ici, même sans internet.</p>' +
        '<button class="btn btn-primaire" type="button" data-action="aller" data-vue="scanner">' + icone("scan") + "Ouvrir le scanner</button></div>";
      return;
    }
    var f = (filtre || "").toLowerCase();
    var items = carnet.slice().sort(function (a, b) { return b.ajoute - a.ajoute; }).filter(function (c) {
      return !f || [c.fn, c.org, c.titre].concat(c.tels, c.emails).join(" ").toLowerCase().indexOf(f) >= 0;
    });
    var deja = $("#recherche-carnet");
    var liste = items.map(function (c) {
      var date = new Date(c.ajoute).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      return '<li><button class="item-carnet" type="button" data-action="fiche" data-id="' + esc(c.id) + '"><span class="avatar">' + esc(initiales(c.fn)) +
        "</span><div><strong>" + esc(c.fn) + "</strong><span>" + esc([c.titre, c.org].filter(Boolean).join(" · ") || c.tels[0] || c.emails[0] || "") + " · " + date + "</span></div></button></li>";
    }).join("") || '<li class="carte-astuce">Aucun résultat.</li>';
    if (deja) { $(".liste-carnet", vue).innerHTML = liste; return; }
    vue.innerHTML = '<div class="vue-entete" data-cascade><h2>Carnet</h2><p>' + carnet.length + " carte" + (carnet.length > 1 ? "s" : "") + " enregistrée" + (carnet.length > 1 ? "s" : "") + " sur ce téléphone.</p></div>" +
      '<div class="recherche">' + icone("search") + '<input id="recherche-carnet" type="search" placeholder="Rechercher un nom, une entreprise…" aria-label="Rechercher dans le carnet"></div>' +
      '<ul class="liste-carnet" data-cascade>' + liste + "</ul>";
    $("#recherche-carnet").addEventListener("input", function (e) { rendreCarnet(e.target.value); });
  }

  /* ------------------------------------------------------------------
     14. PARAMÈTRES (modifier mes infos, apparence, installation)
     ------------------------------------------------------------------ */
  function versLignes(items, avecS, avecNiveau) {
    return (items || []).map(function (it) {
      var p = [it.t];
      if (avecS) p.push(it.s || "");
      p.push(it.d || "");
      if (avecNiveau) p.push(Math.round((Number(it.niveau) || 0.5) * 100));
      return p.join(" | ");
    }).join("\n");
  }
  function depuisLignes(texte, avecS, avecNiveau) {
    return String(texte || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var p = l.split(/\s*\|\s*/), o = { t: p[0] || "" };
      var i = 1;
      if (avecS) o.s = p[i++] || "";
      o.d = p[i++] || "";
      if (avecNiveau) o.niveau = Math.max(0, Math.min(100, parseFloat(p[i]) || 50)) / 100;
      return o;
    });
  }
  function champ(id, libelle, valeur, type, aide) {
    return '<div class="champ"><label for="' + id + '">' + esc(libelle) + "</label>" +
      (type === "textarea"
        ? '<textarea id="' + id + '" name="' + id + '">' + esc(valeur) + "</textarea>"
        : '<input id="' + id + '" name="' + id + '" type="' + (type || "text") + '" value="' + esc(valeur) + '"' + (type === "tel" ? ' inputmode="tel" autocomplete="tel"' : "") + (type === "email" ? ' autocomplete="email"' : "") + ">") +
      (aide ? "<small>" + aide + "</small>" : "") + "</div>";
  }

  function rendreReglages() {
    var p = profil;
    var install;
    if (estInstallee()) install = '<p class="note-info" style="margin:0">' + icone("check") + "<span>L'appli est installée sur cet appareil.</span></p>";
    else if (invitationInstall) install = '<button class="btn btn-primaire btn-plein" type="button" data-action="installer">' + icone("download") + "Installer l'appli</button>";
    else if (estIOS) install = '<p class="note-info" style="margin:0">' + icone("share") + "<span>Dans <strong>Safari</strong> : touche le bouton Partager, puis « Sur l'écran d'accueil ».</span></p>";
    else install = '<p class="note-info" style="margin:0">' + icone("download") + "<span>Ouvre le menu du navigateur (⋮) puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».</span></p>";

    var hl = navigator.serviceWorker && navigator.serviceWorker.controller ? "Prête : l'appli fonctionne sans internet." : "Ouvre l'appli une fois en ligne pour activer le mode hors ligne.";

    $("#vue-reglages").innerHTML =
      '<div data-cascade>' +
      '<section class="groupe"><h3>Installer</h3><p>Pour l\'ouvrir comme une vraie appli, même hors ligne.</p>' + install + "</section>" +
      '<section class="groupe"><h3>Apparence</h3><p>Thème et intensité des animations.</p>' +
        '<div class="champ"><label>Thème</label>' + segment("theme", [["auto", "Auto"], ["clair", "Clair"], ["sombre", "Sombre"]], reglages.theme, "Thème") + "</div>" +
        '<div class="champ"><label>Animations</label>' + segment("anim", [["spectaculaire", "Spectaculaires"], ["sobre", "Sobres"]], reglages.anim, "Animations") +
        (mqReduit.matches ? "<small>Ton appareil demande de réduire les animations : elles sont réduites automatiquement.</small>" : "") + "</div>" +
      "</section>" +
      '<section class="groupe"><h3>Photo</h3><div class="ligne-photo"><img src="' + esc(photoSrc()) + '" alt="Photo actuelle" width="72" height="72">' +
        '<div class="btn-ligne"><button class="btn" type="button" data-action="changer-photo">' + icone("camera") + "Changer</button>" +
        '<button class="btn" type="button" data-action="photo-defaut">' + icone("flip") + "D'origine</button></div></div>" +
        '<input type="file" accept="image/*" id="fichier-photo" hidden></section>' +
      '<form id="form-profil" novalidate>' +
      '<section class="groupe"><h3>Mes coordonnées</h3><p>Elles apparaissent sur la carte et dans le QR.</p>' +
        '<div class="champ-duo">' + champ("f-prenom", "Prénom(s)", p.prenom) + champ("f-nom", "Nom", p.nom) + "</div>" +
        champ("f-titre", "Titre", p.titre) + champ("f-organisation", "École / entreprise", p.organisation) +
        champ("f-telephone", "Téléphone (avec indicatif)", p.telephone, "tel") + champ("f-whatsapp", "WhatsApp", p.whatsapp, "tel") +
        champ("f-email", "Email", p.email, "email") +
        '<div class="champ-duo">' + champ("f-ville", "Ville", p.ville) + champ("f-pays", "Pays", p.pays) + "</div>" +
        champ("f-tags", "Mots-clés de la carte", (p.tags || []).join(", "), "text", "Séparés par des virgules.") +
        champ("f-lien", "Lien de ma carte en ligne", p.lienEnLigne, "url", "Laisse vide : il est détecté automatiquement une fois l'appli publiée.") +
      "</section>" +
      '<section class="groupe"><h3>Contenu du QR</h3><p>Lu par tous les téléphones, sans internet. Plus c\'est long, plus le QR est dense.</p>' +
        champ("f-objectif", "Objectif (mode Essentiel)", p.objectif) +
        champ("f-cvqr", "Texte du CV dans le QR (mode Contact + CV)", p.cvQr, "textarea") +
        '<p class="champ"><small>Taille actuelle du QR : <span class="compteur" id="compteur-qr"></span></small></p>' +
      "</section>" +
      '<section class="groupe"><h3>Profil complet</h3><p>Visible dans l\'appli (onglet Profil), sans limite de taille. Une ligne par élément, parties séparées par « | ».</p>' +
        champ("f-resume", "Résumé", p.resume, "textarea") +
        champ("f-formation", "Formation", versLignes(p.formation, true), "textarea", "Titre | Établissement | Détails") +
        champ("f-projets", "Projets", versLignes(p.projets, true), "textarea", "Titre | Rôle | Détails") +
        champ("f-competences", "Compétences", versLignes(p.competences), "textarea", "Compétence | Détail") +
        champ("f-langues", "Langues", versLignes(p.langues, false, true), "textarea", "Langue | Niveau | Pourcentage (0-100)") +
        champ("f-interets", "Centres d'intérêt", versLignes(p.interets), "textarea", "Intérêt | Détail") +
      "</section>" +
      '<div class="barre-enregistrer"><button class="btn btn-accent btn-plein" type="submit">' + icone("check") + "Enregistrer les modifications</button></div>" +
      "</form>" +
      '<section class="groupe" style="margin-top:14px"><h3>Données</h3><p>Tout est stocké uniquement sur cet appareil. ' + esc(hl) + "</p>" +
        '<div class="fiche-actions"><button class="btn btn-danger" type="button" data-action="reinitialiser">' + icone("flip") + "Revenir aux infos du CV</button>" +
        '<button class="btn btn-danger" type="button" data-action="vider-carnet">' + icone("trash") + "Vider le carnet</button></div></section>" +
      '<p class="carte-astuce">Carte MOC · version 1.0 · 100 % hors ligne</p>' +
      "</div>";

    var form = $("#form-profil");
    form.addEventListener("submit", function (e) { e.preventDefault(); enregistrerFormulaire(); });
    $("#f-cvqr").addEventListener("input", majCompteur);
    $("#f-objectif").addEventListener("input", majCompteur);
    majCompteur();
    $("#fichier-photo").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) changerPhoto(f);
    });
  }

  function lireFormulaire() {
    var v = function (id) { var el = $("#" + id); return el ? el.value.trim() : ""; };
    return Object.assign({}, profil, {
      prenom: v("f-prenom"), nom: v("f-nom"), titre: v("f-titre"), organisation: v("f-organisation"),
      telephone: v("f-telephone"), whatsapp: v("f-whatsapp"), email: v("f-email"),
      ville: v("f-ville"), pays: v("f-pays"), lienEnLigne: v("f-lien"),
      tags: v("f-tags").split(",").map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 4),
      objectif: v("f-objectif"), cvQr: $("#f-cvqr").value.trim(), resume: v("f-resume"),
      formation: depuisLignes(v("f-formation"), true), projets: depuisLignes(v("f-projets"), true),
      competences: depuisLignes(v("f-competences")), langues: depuisLignes(v("f-langues"), false, true),
      interets: depuisLignes(v("f-interets"))
    });
  }

  function majCompteur() {
    var brouillon = lireFormulaire();
    var info = fabriquerQR(VCard.construire(brouillon, { mode: "complet", lien: lienEnLigne() }));
    var el = $("#compteur-qr");
    if (!el) return;
    if (!info) { el.textContent = "trop long pour un QR !"; el.style.color = "var(--danger)"; return; }
    var d = evaluerDensite(info);
    el.textContent = info.octets.toLocaleString("fr-FR") + " octets · " + d.libelle.toLowerCase();
    el.style.color = d.classe === "trop" ? "var(--danger)" : "";
  }

  function enregistrerFormulaire() {
    var nouveau = lireFormulaire();
    var erreur = null;
    if (!nouveau.prenom && !nouveau.nom) erreur = ["f-prenom", "Indique au moins ton nom."];
    else if (nouveau.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nouveau.email)) erreur = ["f-email", "Cet email n'a pas l'air valide."];
    else if (nouveau.telephone && VCard.telCompact(nouveau.telephone).replace("+", "").length < 8) erreur = ["f-telephone", "Numéro trop court : ajoute l'indicatif (+224…)."];
    else if (nouveau.lienEnLigne && !/^https:\/\//.test(nouveau.lienEnLigne)) erreur = ["f-lien", "Le lien doit commencer par https://"];
    $$(".champ .erreur").forEach(function (e) { e.remove(); });
    if (erreur) {
      var champEl = $("#" + erreur[0]);
      var msg = document.createElement("small");
      msg.className = "erreur"; msg.style.color = "var(--danger)"; msg.style.fontWeight = "600"; msg.textContent = erreur[1];
      champEl.parentNode.appendChild(msg);
      champEl.focus();
      return;
    }
    if (!fabriquerQR(VCard.construire(nouveau, { mode: "complet", lien: lienEnLigne() }))) {
      toast("Le texte du CV est trop long pour le QR : raccourcis-le.");
      $("#f-cvqr").focus();
      return;
    }
    profil = nouveau;
    if (!Stock.ecrire(CLE_PROFIL, profil)) { toast("Impossible d'enregistrer (stockage plein ?)."); return; }
    vibrer(20);
    rendreCarte();
    toast("Modifications enregistrées");
  }

  function changerPhoto(fichier) {
    var url = URL.createObjectURL(fichier);
    chargerImage(url).then(function (img) {
      var t = 480, cv = document.createElement("canvas");
      cv.width = cv.height = t;
      var cote = Math.min(img.naturalWidth, img.naturalHeight);
      cv.getContext("2d").drawImage(img, (img.naturalWidth - cote) / 2, (img.naturalHeight - cote) / 2, cote, cote, 0, 0, t, t);
      profil.photo = cv.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url);
      if (!Stock.ecrire(CLE_PROFIL, profil)) { toast("Photo trop lourde pour le stockage."); return; }
      rendreReglages(); rendreCarte();
      toast("Photo mise à jour");
    }).catch(function () { toast("Image illisible."); });
  }

  /* ------------------------------------------------------------------
     15. ACTIONS (délégation d'événements)
     ------------------------------------------------------------------ */
  var confirmations = {};
  function confirmer(bouton, cle, texte) {
    if (confirmations[cle]) { delete confirmations[cle]; return true; }
    confirmations[cle] = true;
    var ancien = bouton.innerHTML;
    bouton.innerHTML = icone("trash") + texte;
    setTimeout(function () { if (confirmations[cle]) { delete confirmations[cle]; bouton.innerHTML = ancien; } }, 3500);
    return false;
  }

  function copier(texte, bouton) {
    var fini = function () {
      if (bouton) { bouton.classList.add("ok"); setTimeout(function () { bouton.classList.remove("ok"); }, 1500); }
      vibrer(10); toast("Copié");
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texte).then(fini, function () { copieSecours(texte); fini(); });
    else { copieSecours(texte); fini(); }
  }
  function copieSecours(texte) {
    var ta = document.createElement("textarea");
    ta.value = texte; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* rien */ }
    ta.remove();
  }

  document.addEventListener("click", function (e) {
    var seg = e.target.closest(".segment button");
    if (seg) { choisirSegment(seg); return; }

    var b = e.target.closest("[data-action]");
    if (!b) return;
    var a = b.dataset.action;
    switch (a) {
      case "retourner": retournerCarte(); break;
      case "voir-profil": aller("profil"); break;
      case "aller": demanderFermetureSiOuverte(); aller(b.dataset.vue); break;
      case "plein": ouvrirPleinEcran(); break;
      case "partager": ouvrirPartage(); break;
      case "partage-invitation": demanderFermeture(); envoyerInvitation(); break;
      case "partage-copier": demanderFermeture(); copier(lienInvitation(), null); break;
      case "partage-qr":
        demanderFermeture();
        setTimeout(function () { ouvrirPleinEcran(lienInvitation(), "Découvre ma carte", "Scanne avec l'appareil photo pour ouvrir ma carte · Touchez pour fermer"); }, 280);
        break;
      case "vcf": exporterVCF(); break;
      case "png": exporterPNG(); break;
      case "svg": exporterSVG(); break;
      case "image": exporterImage(); break;
      case "copier": copier(b.dataset.valeur, b); break;
      case "scan-demarrer": Scanner.demarrer(); break;
      case "scan-arreter": Scanner.arreter(); Scanner.statut(""); break;
      case "scan-image": $("#scan-fichier").click(); break;
      case "fermer-feuille": demanderFermeture(); break;
      case "copier-resultat": if (resultatCourant) copier(resultatCourant.brut, null); break;
      case "garder":
        if (resultatCourant && resultatCourant.type === "vcard") {
          var entree = Object.assign({ id: "c" + Date.now().toString(36), ajoute: Date.now() }, resultatCourant);
          carnet.push(entree); sauverCarnet(); vibrer(20);
          b.outerHTML = '<p class="note-info" style="margin:0">' + icone("check") + "<span>Enregistrée dans ton carnet.</span></p>";
          toast("Carte ajoutée au carnet");
        }
        break;
      case "vers-contacts":
        if (resultatCourant) {
          var blob = new Blob([resultatCourant.brut], { type: "text/vcard;charset=utf-8" });
          var nom = (resultatCourant.fn || "contact").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-") + ".vcf";
          if (estIOS) { window.location.href = URL.createObjectURL(blob); } else { telecharger(blob, nom); toast("Ouvre " + nom + " pour l'ajouter aux contacts"); }
        }
        break;
      case "fiche":
        var c = carnet.find(function (x) { return x.id === b.dataset.id; });
        if (c) { resultatCourant = c; ouvrirFeuille(ficheHTML(c, true)); }
        break;
      case "supprimer":
        if (!confirmer(b, "sup", "Confirmer la suppression")) break;
        carnet = carnet.filter(function (x) { return x.id !== b.dataset.id; });
        sauverCarnet(); demanderFermeture(); rendreCarnet(); toast("Carte supprimée");
        break;
      case "installer":
        if (invitationInstall) {
          invitationInstall.prompt();
          invitationInstall.userChoice.finally(function () { invitationInstall = null; rendreReglages(); });
        }
        break;
      case "changer-photo": $("#fichier-photo").click(); break;
      case "photo-defaut": profil.photo = ""; Stock.ecrire(CLE_PROFIL, profil); rendreReglages(); rendreCarte(); toast("Photo d'origine rétablie"); break;
      case "reinitialiser":
        if (!confirmer(b, "reinit", "Toucher encore pour confirmer")) break;
        Stock.effacer(CLE_PROFIL); profil = cloner(DEFAUT); rendreReglages(); rendreCarte(); toast("Infos du CV rétablies");
        break;
      case "vider-carnet":
        if (!confirmer(b, "vider", "Toucher encore pour vider")) break;
        carnet = []; sauverCarnet(); toast("Carnet vidé");
        break;
    }
  });

  function demanderFermetureSiOuverte() { if (!$("#feuille").hidden) demanderFermeture(); }

  /* Contrôles segmentés (mode du QR, thème, animations) */
  function choisirSegment(bouton) {
    var groupe = bouton.closest(".segment"), nom = groupe.dataset.segment, valeur = bouton.dataset.valeur;
    var boutons = $$("button", groupe), i = boutons.indexOf(bouton);
    boutons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === bouton)); });
    $(".segment-curseur", groupe).style.transform = "translateX(calc(" + i * 100 + "% + " + i * 4 + "px))";
    reglages[nom] = valeur;
    Stock.ecrire(CLE_REGLAGES, reglages);
    vibrer(8);
    if (nom === "qrMode") {
      var info = remplirQR($("#qr-principal"));
      majDensite(info); animerQR($("#qr-principal"));
      if ($("#qr-verso")) remplirQR($("#qr-verso"));
    } else {
      appliquerReglages();
    }
  }

  /* Onglets + boutons de l'en-tête */
  $$(".tabbar button").forEach(function (b) { b.addEventListener("click", function () { vibrer(6); aller(b.dataset.vue); }); });
  $("#btn-reglages").addEventListener("click", function () { aller("reglages"); });
  $("#btn-retour").addEventListener("click", function () { aller(vuePrecedente || "carte"); });
  $("#qr-plein").addEventListener("click", demanderFermeture);
  $("#feuille").addEventListener("click", function (e) { if (e.target.hasAttribute("data-fermer")) demanderFermeture(); });

  /* Installation (Android / ordinateur) */
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    invitationInstall = e;
    if (vueActive === "reglages") rendreReglages();
  });
  window.addEventListener("appinstalled", function () { invitationInstall = null; toast("Appli installée"); });

  /* L'onglet passe en arrière-plan : on coupe la caméra */
  document.addEventListener("visibilitychange", function () { if (document.hidden && Scanner.actif) Scanner.arreter(); });

  /* ------------------------------------------------------------------
     16. DÉMARRAGE
     ------------------------------------------------------------------ */
  function demarrer() {
    appliquerReglages();
    if (VISITEUR) {
      document.body.classList.add("mode-visiteur");
      $("#btn-reglages").hidden = true;
    }
    rendreCarte();
    Scanner.rendre();
    majTabbar();
    lancerSplash().then(entreeCarte);

    /* Service worker : met tous les fichiers en cache pour le hors ligne */
    if ("serviceWorker" in navigator && (window.isSecureContext)) {
      navigator.serviceWorker.register("sw.js").catch(function () { /* hors https : pas de cache */ });
      var dejaControle = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (dejaControle) toast("Nouvelle version installée");
      });
    }
  }
  demarrer();
})();
