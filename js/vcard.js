/* =====================================================================
   vCard 3.0 : création (pour le QR et le fichier .vcf) et lecture
   (pour le scanner intégré). Aucun accès réseau.
   ===================================================================== */
(function () {
  "use strict";

  /* Échappement des valeurs selon la RFC 2426 */
  function echapper(v) {
    return String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  /* Numéro au format international compact : +224626067105 */
  function telCompact(t) {
    var s = String(t || "").replace(/[^\d+]/g, "");
    return s;
  }

  /* Lien WhatsApp à partir d'un numéro */
  function lienWhatsApp(t) {
    var d = telCompact(t).replace(/^\+/, "");
    return d ? "https://wa.me/" + d : "";
  }

  /**
   * Construit le texte vCard.
   * @param p        profil
   * @param options  { mode: "complet" | "essentiel" | "fichier", lien, photoBase64 }
   */
  function construire(p, options) {
    options = options || {};
    var mode = options.mode || "complet";
    var L = [];
    L.push("BEGIN:VCARD");
    L.push("VERSION:3.0");
    L.push("N:" + echapper(p.nom) + ";" + echapper(p.prenom) + ";;;");
    L.push("FN:" + echapper((p.prenom + " " + p.nom).trim()));
    if (p.organisation) L.push("ORG:" + echapper(p.organisation));
    if (p.titre) L.push("TITLE:" + echapper(p.titre));
    if (p.telephone) L.push("TEL;TYPE=CELL:" + telCompact(p.telephone));
    if (p.email) L.push("EMAIL;TYPE=INTERNET:" + p.email.trim());
    if (p.ville || p.pays) L.push("ADR;TYPE=HOME:;;;" + echapper(p.ville) + ";;;" + echapper(p.pays));
    var wa = lienWhatsApp(p.whatsapp);
    if (wa) L.push("URL:" + wa);
    if (options.lien) L.push("URL:" + options.lien);

    var note = "";
    if (mode === "essentiel") note = p.objectif || "";
    else if (mode === "complet") note = p.cvQr || p.objectif || "";
    else if (mode === "fichier") note = noteComplete(p);
    /* L'email est aussi écrit en tête de la note : certains lecteurs de QR
       (aperçu de l'appareil photo Android, etc.) n'affichent que le téléphone. */
    if ((mode === "complet" || mode === "essentiel") && p.email) {
      note = "Email : " + p.email.trim() + (note ? "\n" + note : "");
    }
    if (note) L.push("NOTE:" + echapper(note));

    if (mode === "fichier" && options.photoBase64) {
      L.push("PHOTO;ENCODING=b;TYPE=JPEG:" + options.photoBase64);
    }
    L.push("END:VCARD");
    return L.join("\r\n");
  }

  /* Note détaillée pour le fichier .vcf (pas de limite de taille) */
  function noteComplete(p) {
    var lignes = [];
    if (p.objectif) lignes.push(p.objectif, "");
    if (p.resume) lignes.push(p.resume, "");
    function bloc(titre, items) {
      if (!items || !items.length) return;
      lignes.push(titre.toUpperCase());
      items.forEach(function (it) {
        var l = "- " + it.t;
        if (it.s) l += " (" + it.s + ")";
        if (it.d) l += " : " + it.d;
        lignes.push(l);
      });
      lignes.push("");
    }
    bloc("Formation", p.formation);
    bloc("Projets", p.projets);
    bloc("Compétences", p.competences);
    bloc("Langues", p.langues);
    bloc("Centres d'intérêt", p.interets);
    return lignes.join("\n").trim();
  }

  /* Taille réelle en octets (UTF-8), c'est elle qui compte pour le QR */
  function octets(texte) {
    return new TextEncoder().encode(texte).length;
  }

  /* ---------------------------------------------------------------
     LECTURE : vCard (2.1/3.0/4.0), MECARD, lien ou texte simple
     --------------------------------------------------------------- */
  function desechapper(v) {
    return String(v || "")
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }

  function lire(texte) {
    var t = String(texte || "").trim();
    if (/^BEGIN:VCARD/i.test(t)) return lireVCard(t);
    if (/^MECARD:/i.test(t)) return lireMeCard(t);
    if (/^https?:\/\//i.test(t)) return { type: "lien", url: t, brut: t };
    return { type: "texte", texte: t, brut: t };
  }

  function lireVCard(t) {
    // Déplier les lignes (une ligne qui commence par espace/tab continue la précédente)
    var lignes = t.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
    var c = { type: "vcard", fn: "", nom: "", org: "", titre: "", tels: [], emails: [], urls: [], adresse: "", note: "", brut: t };
    lignes.forEach(function (ligne) {
      var i = ligne.indexOf(":");
      if (i < 0) return;
      var gauche = ligne.slice(0, i);
      var valeur = ligne.slice(i + 1);
      var parties = gauche.split(";");
      var cle = parties[0].replace(/^item\d+\./i, "").toUpperCase();
      // Gestion basique du quoted-printable (vCard 2.1)
      if (/ENCODING=QUOTED-PRINTABLE/i.test(gauche)) {
        try {
          var bytes = valeur.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
          valeur = decodeURIComponent(escape(bytes));
        } catch (e) { /* on garde la valeur brute */ }
      }
      switch (cle) {
        case "FN": c.fn = desechapper(valeur); break;
        case "N": c.nom = valeur.split(";").map(desechapper).filter(Boolean).reverse().join(" "); break;
        case "ORG": c.org = valeur.split(";").map(desechapper).filter(Boolean).join(", "); break;
        case "TITLE": c.titre = desechapper(valeur); break;
        case "TEL": c.tels.push(valeur.replace(/^tel:/i, "").trim()); break;
        case "EMAIL": c.emails.push(valeur.trim()); break;
        case "URL": c.urls.push(desechapper(valeur).trim()); break;
        case "ADR": c.adresse = valeur.split(";").map(desechapper).filter(Boolean).join(", "); break;
        case "NOTE": c.note = desechapper(valeur); break;
      }
    });
    if (!c.fn) c.fn = c.nom || (c.emails[0] || "Contact sans nom");
    return c;
  }

  function lireMeCard(t) {
    var c = { type: "vcard", fn: "", nom: "", org: "", titre: "", tels: [], emails: [], urls: [], adresse: "", note: "", brut: "" };
    t.replace(/^MECARD:/i, "").split(/;(?=[A-Z\-]+:)/i).forEach(function (part) {
      var i = part.indexOf(":");
      if (i < 0) return;
      var k = part.slice(0, i).toUpperCase(), v = part.slice(i + 1).replace(/;+$/, "").replace(/\\(.)/g, "$1");
      if (k === "N") c.fn = v.split(",").reverse().join(" ").trim();
      else if (k === "TEL") c.tels.push(v);
      else if (k === "EMAIL") c.emails.push(v);
      else if (k === "URL") c.urls.push(v);
      else if (k === "ADR") c.adresse = v;
      else if (k === "NOTE") c.note = v;
      else if (k === "ORG") c.org = v;
    });
    // On reconstruit une vraie vCard pour pouvoir l'ajouter aux contacts
    var L = ["BEGIN:VCARD", "VERSION:3.0", "FN:" + echapper(c.fn || "Contact")];
    if (c.org) L.push("ORG:" + echapper(c.org));
    c.tels.forEach(function (x) { L.push("TEL:" + x); });
    c.emails.forEach(function (x) { L.push("EMAIL:" + x); });
    c.urls.forEach(function (x) { L.push("URL:" + x); });
    if (c.adresse) L.push("ADR:;;" + echapper(c.adresse) + ";;;;");
    if (c.note) L.push("NOTE:" + echapper(c.note));
    L.push("END:VCARD");
    c.brut = L.join("\r\n");
    return c;
  }

  window.VCard = {
    construire: construire,
    lire: lire,
    octets: octets,
    telCompact: telCompact,
    lienWhatsApp: lienWhatsApp,
    noteComplete: noteComplete
  };
})();
