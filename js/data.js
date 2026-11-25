/* =====================================================================
   DONNÉES PAR DÉFAUT DE LA CARTE (extraites du CV)
   ---------------------------------------------------------------------
   - Ce fichier est la "version publique" de la carte : c'est ce que voit
     une personne qui ouvre le lien en ligne contenu dans le QR.
   - Les modifications faites dans l'appli (Paramètres) sont enregistrées
     uniquement sur ton téléphone. Pour mettre à jour la page en ligne,
     modifie aussi ce fichier puis republie (voir GUIDE.md).
   ===================================================================== */
window.PROFIL_DEFAUT = {
  prenom: "Mory Oumar",
  nom: "Camara",
  titre: "Étudiant en Management International (L2)",
  organisation: "BEM Conakry",
  telephone: "+224 626 06 71 05",
  whatsapp: "+224 626 06 71 05",
  email: "papimoryoumarcamara@gmail.com",
  ville: "Conakry",
  pays: "Guinée",
  /* Laisser vide : une fois l'appli en ligne, l'adresse est détectée
     automatiquement. Sinon, mettre l'adresse complète (https://...). */
  lienEnLigne: "",
  tags: ["Management", "Environnement", "IA"],

  objectif: "Stage : Assistant Manager / Assistant Import-Export / Junior Business Developer",

  resume:
    "Étudiant rigoureux et motivé en 2e année à BEM Conakry, doté d'un esprit d'analyse développé grâce à un parcours en Sciences Mathématiques. Passionné par le management, l'impact environnemental et les nouvelles technologies (IA), je souhaite mettre mes compétences et ma proactivité au service de votre entreprise.",

  /* Texte du CV placé dans le QR (note du contact). Il reste lisible par
     n'importe quel téléphone, sans internet. Plus il est long, plus le QR
     est dense : l'appli affiche la taille en direct. */
  cvQr:
    "Objectif : stage Assistant Manager / Assistant Import-Export / Junior Business Developer.\n" +
    "Profil : étudiant rigoureux et motivé, 2e année Management International à BEM Conakry ; esprit d'analyse (bac Sciences Mathématiques) ; passionné de management, d'environnement et d'IA.\n" +
    "Formation : Licence Management International, BEM Conakry (management, économie, comptabilité, Passeport IA) ; Bac Sciences Mathématiques, mention Assez Bien.\n" +
    "Projet : solution de recyclage des ordures à Conakry (collecte, tri, valorisation), en étude de faisabilité.\n" +
    "Compétences : négociation commerciale, analyse sectorielle et de marché, Word, PowerPoint, Excel, outils d'IA.\n" +
    "Langues : français courant, anglais intermédiaire.\n" +
    "Intérêts : environnement, IA en entreprise, leadership, finance.",

  formation: [
    { t: "Licence Management International", s: "BEM Conakry (Bordeaux École de Management) · 2e année",
      d: "Matières clés : management, économie globale et contemporaine, comptabilité générale, Passeport IA, développement personnel." },
    { t: "Baccalauréat unique", s: "Guinée · Série Sciences Mathématiques",
      d: "Mention Assez Bien." }
  ],

  projets: [
    { t: "Solution de recyclage d'ordures en Guinée", s: "Concepteur du projet · étude de faisabilité",
      d: "Structurer une solution viable de collecte, tri et valorisation des déchets ménagers à Conakry pour réduire l'impact environnemental. Analyse des besoins du marché local, étude de la logistique de collecte, recherche de solutions écologiques économiquement viables." }
  ],

  competences: [
    { t: "Négociation commerciale", d: "Techniques de négociation" },
    { t: "Analyse de marché", d: "Analyse sectorielle et d'opportunités" },
    { t: "Word", d: "Rédaction de rapports" },
    { t: "PowerPoint", d: "Présentations professionnelles" },
    { t: "Excel", d: "Bases de données et calculs simples" },
    { t: "Outils d'IA", d: "Initiation pratique (Passeport IA)" }
  ],

  /* niveau : de 0 à 1 (affiché sous forme de jauge) */
  langues: [
    { t: "Français", d: "Courant, langue de travail", niveau: 0.95 },
    { t: "Anglais", d: "Intermédiaire, en perfectionnement", niveau: 0.55 }
  ],

  interets: [
    { t: "Environnement et écologie", d: "Sensibilisation citoyenne, gestion des déchets" },
    { t: "Nouvelles technologies", d: "Veille sur l'IA appliquée aux entreprises" },
    { t: "Développement personnel", d: "Leadership, finance, organisation personnelle" }
  ],

  photo: "" /* vide = photo par défaut (assets/photo.jpg) */
};
