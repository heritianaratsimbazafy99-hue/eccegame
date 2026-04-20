import type {
  CardTemplate,
  CardTruth,
  DecisionOptionId,
  GameSnapshot,
  GeneratedCard,
  Participant,
  TeamGame
} from "../types";
import { createRng, getTruthDistribution, hashString, normalizeText, shuffleArray, slugify } from "./utils";

type Archetype =
  | "executive"
  | "sales-enterprise"
  | "sales-retail"
  | "finance"
  | "marketing"
  | "customer-service"
  | "hr"
  | "governance"
  | "network"
  | "it"
  | "fintech"
  | "external"
  | "strategy"
  | "operations";

interface ScenarioBlueprint {
  scenarioTitle: string;
  atmosphere: string;
  situation: string;
  options: [TeamGame["options"][0], TeamGame["options"][1]];
  correctDecision: TeamGame["correctDecision"];
  rationale: string;
  decks: Record<CardTruth, CardTemplate[]>;
}

interface FictionOverlay {
  scenarioTitle: string;
  atmosphere: string;
  situation: string;
  options: [TeamGame["options"][0], TeamGame["options"][1]];
  rationale: string;
}

interface FictionCardTone {
  headlineLeads: string[];
  headlineStings: string[];
  bodyLeads: string[];
  bodyHooks: string[];
  shareLeads: string[];
  shareClosers: string[];
}

interface TextReplacement {
  pattern: RegExp;
  replacement: string;
}

const trueVariants = [
  "Le détail change l'intensité du risque, pas la direction générale du signal.",
  "Ce point ne décide pas tout seul, mais il confirme bien la tendance lourde du matin.",
  "La nuance locale est utile pour arbitrer la vitesse d'exécution, pas pour changer de cap."
];

const partialVariants = [
  "Intéressant pour le débat, mais trop partiel pour piloter l'équipe dessus.",
  "Le signal mérite d'être partagé, tout en restant explicitement mis en doute.",
  "À considérer comme un indice et non comme une preuve."
];

const falseVariants = [
  "Aucune source solide n'a confirmé ce point au moment de l'arbitrage.",
  "Le message est crédible à l'oreille, mais il ne tient pas face aux faits consolidés.",
  "Le piège ici est la confiance dans une information bien racontée, pas bien vérifiée."
];

const sharePromptLeads = [
  "A lacher avec l'air de ne pas y toucher:",
  "A glisser au moment ou tout le monde croit avoir compris:",
  "A injecter juste avant que le debat parte trop vite dans le decor:",
  "A sortir avec un calme beaucoup trop theatricalement innocent:"
];

const sharePromptClosers = [
  "Puis laisse un petit silence faire son travail.",
  "Et regarde qui acquiesce un peu trop vite.",
  "Avec un air neutre, c'est toujours plus cruel.",
  "Puis observe qui veut changer de sujet dans les dix secondes.",
  "Et n'oublie pas: une question bien placee vaut parfois mieux qu'un monologue."
];

const cardHeadlineLeads = [
  "Note glissee sous la porte:",
  "Bruit de couloir premium:",
  "Confidence des coulisses:",
  "Petit detail qui gratte:",
  "Signal a ne surtout pas raconter trop vite:"
];

const cardHeadlineStings = [
  "version mission",
  "edition salle de crise",
  "a manipuler avec soin",
  "effet domino possible",
  "a raconter sans trembler"
];

const missionCodeNames: Record<Archetype, string[]> = {
  executive: ["Dossier Minuit", "Ligne Noircie", "Protocole Fenetre"],
  "sales-enterprise": ["Chambre Noire", "Velours Truque", "Jeton Eclipse"],
  "sales-retail": ["Parade Eclipse", "Mascotte Fantome", "Jackpot Nebuleux"],
  finance: ["Coffre Basilic", "Jetons Sous Cloche", "Pont de Marbre"],
  marketing: ["Mirage a Paillettes", "Confetti Phantom", "Scene aux Miroirs"],
  "customer-service": ["Canal SOS", "Atlas Surchauffe", "Frequence Brouillee"],
  hr: ["Camp Helios", "Boussole Fievreuse", "Sommet a Blanc"],
  governance: ["Rune de Velours", "Sceau de Minuit", "Table des Cires"],
  network: ["Citadelle Nox", "Pont Radar", "Nuit Rouge Orbitale"],
  it: ["Portail Mimic", "Sas de Glitch", "Console Obsidienne"],
  fintech: ["Jeton Noir", "Porte Froide", "Marche des Mules"],
  external: ["Orion Sous Masque", "Grand Flash", "Cristal a Retardement"],
  strategy: ["Six Portes Menteuses", "Boussole Fumee", "Oasis Factice"],
  operations: ["Tunnel Carmin", "Levier Interdit", "Cabine Fantome"]
};

const atmosphereHooksByArchetype: Partial<Record<Archetype, string[]>> = {
  "sales-enterprise": [
    "Ici, les compliments valent parfois moins qu'un clin d'oeil trop poli d'un faux croupier.",
    "Plus la salle semble luxueuse, plus il faut se demander qui est deja en train de mentir avec elegance."
  ],
  "sales-retail": [
    "Le decor sent le sucre chaud, les mascottes transpirent et chaque sourire peut cacher un plan completement douteux.",
    "C'est le type d'endroit ou on peut perdre une mallette, un suspect et sa dignite en moins d'une chanson de parade."
  ],
  marketing: [
    "Sous les paillettes, la vraie question est toujours la meme: qui manipule le show et qui se fait manipuler par lui ?",
    "Tout scintille assez fort pour faire croire que la premiere idee brillante est forcement la bonne."
  ],
  governance: [
    "Le silence est si propre qu'on entend presque les faux serments se repasser tout seuls.",
    "Personne ne court. C'est justement ce qui rend chaque sourire beaucoup plus suspect."
  ],
  network: [
    "La station parait majestueuse jusqu'au moment ou l'on remarque que chaque voyant clignote comme un acteur qui surjoue son calme.",
    "Plus la coque reste digne, plus il faut se mefier des petites vibrations qui disent tout l'inverse."
  ],
  it: [
    "Tout a l'air tres technique, donc tres rassurant. C'est evidemment le moment prefere des catastrophes bien habillees.",
    "Dans ce labo, le vrai danger adore porter une etiquette 'correctif mineur'."
  ],
  fintech: [
    "Les jetons brillent, les capes sourient et tout le monde pretend ne rien cacher, ce qui est deja en soi une information utile.",
    "Plus le marche parait fluide, plus il faut regarder qui glisse trop facilement entre les barrages."
  ],
  external: [
    "La salle est pleine de gens tres beaux, tres polis et probablement un peu trop heureux d'etre photographies.",
    "Chaque coupe de champagne semble contenir au moins une moitie de mensonge diplomatique."
  ],
  strategy: [
    "La carte est superbe, donc dangereuse. Les beaux plans ont souvent une passion regrettable pour les gouffres bien cadres.",
    "Plus les fleches paraissent evidentes, plus il faut se demander qui les a peintes et dans quel but."
  ],
  operations: [
    "Le train avance, le decor tremble et toute personne qui dit 'c'est simple' merite automatiquement d'etre observee de tres pres.",
    "Le convoi garde de l'allure, mais il suffit d'un faux conducteur pour transformer la scene en opera ferroviaire."
  ]
};

const situationHooksByArchetype: Partial<Record<Archetype, string[]>> = {
  "sales-enterprise": [
    "Le piege n'est pas seulement dans la mallette: il est dans la facon dont certaines bonnes idees veulent absolument paraitre irresistibles.",
    "Mini-regle de survie: quand un plan semble trop glamour pour echouer, il a souvent deja commence a vous pieger."
  ],
  "sales-retail": [
    "Le plus dur n'est pas de reperer les mouvements suspects, c'est de resister a l'envie d'arreter tout ce qui bouge simplement parce que ca bouge.",
    "La foule adore recompenser le premier geste heroique. La mission, elle, prefere le bon."
  ],
  marketing: [
    "Ici, l'erreur classique consiste a confondre spectacle et controle.",
    "Le decor vous propose plusieurs histoires tres jolies; une seule merite peut-etre vraiment votre confiance."
  ],
  governance: [
    "Le jeu consiste surtout a distinguer le rituel utile du theatre qui veut vous endormir.",
    "Tout semble soigneusement prepare. C'est donc probablement incomplet quelque part."
  ],
  network: [
    "La question n'est pas 'est-ce que ca peut tenir ?' mais plutot 'qu'est-ce qu'on achete exactement en gagnant dix minutes ?'.",
    "La station offre juste assez de confort pour rendre l'erreur tres tentante."
  ],
  it: [
    "Plus le faux correctif est joli, plus il faut verifier s'il resout quelque chose d'autre que votre anxiete du moment.",
    "Le mini-jeu cache ici, c'est de separer le vrai nettoyage du patch maquillage."
  ],
  fintech: [
    "Le plus grand classique du marche noir reste toujours le meme: une fausse impression de fluidite pour vous faire hesiter trop longtemps.",
    "Plus le plan semble bon pour les chiffres du soir, plus il faut regarder ce qu'il cache pour demain matin."
  ],
  external: [
    "Le vrai choix n'oppose pas vitesse et lenteur; il oppose photo flatteuse et sortie sans catastrophe.",
    "Quelqu'un dans la salle compte sur votre envie de faire un beau moment. Ne lui facilitez pas trop le travail."
  ],
  strategy: [
    "Le bon cap ne sera pas forcement celui qui permet la plus belle phrase de lancement.",
    "Les portes les plus accueillantes ont un petit faible pour les equipes trop pressees."
  ],
  operations: [
    "Le bruit de fond vous pousse vers le grand geste. Les details, eux, essaient de vous raconter une autre histoire.",
    "Le vrai suspense est toujours le meme: est-ce qu'on agit pour etre vus, ou pour toucher juste ?"
  ]
};

const optionFlavorByArchetype: Partial<
  Record<Archetype, Record<DecisionOptionId, string[]>>
> = {
  "sales-enterprise": {
    A: ["Mode faux incendie", "Plan pluie de jetons", "Option panique chic"],
    B: ["Mode filature VIP", "Plan ascenseur prive", "Option velours froid"]
  },
  "sales-retail": {
    A: ["Mode evacuation sucree", "Plan mascotte en vrac", "Option parc fige"],
    B: ["Mode char leurre", "Plan tunnels de service", "Option parade piegee"]
  },
  marketing: {
    A: ["Mode confetti total", "Plan phrase-code piratee", "Option megashow"],
    B: ["Mode ecran miroir", "Plan rideau patient", "Option regard oblique"]
  },
  governance: {
    A: ["Mode scandale en velours", "Plan sceaux a nu", "Option banquet stoppe"],
    B: ["Mode rune finale", "Plan faux dignitaire", "Option silence piege"]
  },
  network: {
    A: ["Mode purge orbitale", "Plan noyau nu", "Option soute ouverte"],
    B: ["Mode drone appat", "Plan traceur fantome", "Option nuit rouge"]
  },
  it: {
    A: ["Mode purge de labo", "Plan sas ferme", "Option coupure nette"],
    B: ["Mode mimic en cage", "Plan portail piege", "Option quarantaine sexy"]
  },
  fintech: {
    A: ["Mode barrages d'acier", "Plan glace vive", "Option marche coupe"],
    B: ["Mode mules marquees", "Plan roi invisible", "Option ronde de trop"]
  },
  external: {
    A: ["Mode toast force", "Plan salon fige", "Option flash brutal"],
    B: ["Mode etiquette venimeuse", "Plan pas de cote", "Option photo tardive"]
  },
  strategy: {
    A: ["Mode convoi casse", "Plan portes multiples", "Option carte ouverte"],
    B: ["Mode goulet voulu", "Plan deux portes", "Option caravane serree"]
  },
  operations: {
    A: ["Mode wagons largues", "Plan frein d'urgence", "Option grand geste"],
    B: ["Mode cabine surveillee", "Plan levier muet", "Option tunnel long"]
  }
};

const rationaleHooksByArchetype: Partial<Record<Archetype, string[]>> = {
  "sales-enterprise": [
    "Lecture animateur: la salle adore les plans qui brillent, pas forcement ceux qui survivent a la derniere porte.",
    "Le tri gagnant consiste ici a ne pas confondre elegance et fiabilite."
  ],
  "sales-retail": [
    "La foule recompense le spectaculaire. La mission, elle, recompense surtout la precision et le sang-froid.",
    "Le bon move n'essaie pas de dominer tout le parc, seulement la vraie zone de passage."
  ],
  marketing: [
    "Quand le decor chante trop fort, la lucidité doit presque devenir une discipline sportive.",
    "La bonne reponse recompense ici la patience tactique, pas la première idee instagrammable."
  ],
  governance: [
    "Dans cette salle, l'empressement sent souvent la cire chaude et la catastrophe administrative.",
    "Le bon arbitrage consiste a laisser le mauvais acteur oublier son texte."
  ],
  network: [
    "La tentation du confort immediat est le vrai saboteur secondaire de cette citadelle.",
    "Le bon choix demande d'accepter une tension courte pour eviter une humiliation durable."
  ],
  it: [
    "Le faux heroisme adore les patchs rapides. La vraie victoire aime davantage les pieges propres et les reveils sans surprise.",
    "Ce dossier recompense l'equipe qui traite l'ennemi entier, pas seulement son costume."
  ],
  fintech: [
    "Ici, sauver la fluidite de facade peut couter beaucoup plus cher que ralentir intelligemment les flux douteux.",
    "La bonne reponse accepte une petite friction pour eviter une grande invitation aux pirates."
  ],
  external: [
    "Le meilleur move n'est pas celui qui produit la plus belle photo, mais celui qui survit a l'apres-photo.",
    "Le dossier punit surtout les equipes trop amoureuses du moment waouh."
  ],
  strategy: [
    "La bonne equipe n'est pas celle qui adore sa carte, mais celle qui adore encore plus la mettre a l'epreuve.",
    "Le vrai courage, ici, consiste a renoncer a la grande fresque pour obtenir une preuve."
  ],
  operations: [
    "Ce jeu recompense les groupes qui savent resister au theatre du grand levier salvateur.",
    "Le vrai move est moins joli a raconter, beaucoup plus satisfaisant a subir."
  ]
};

function pickFromPool<T>(pool: T[], rng: () => number): T {
  return pool[Math.floor(rng() * pool.length)];
}

function withFallbacks(pool: CardTemplate[], count: number, variants: string[]): CardTemplate[] {
  if (pool.length >= count) {
    return pool.slice(0, count);
  }

  const expanded = [...pool];
  let index = 0;
  while (expanded.length < count) {
    const source = pool[index % pool.length];
    const variant = variants[index % variants.length];
    expanded.push({
      headline: `${source.headline} - angle ${index + 1}`,
      body: `${source.body} ${variant}`,
      sharePrompt: source.sharePrompt,
      adminTruth: source.adminTruth
    });
    index += 1;
  }
  return expanded;
}

function inferArchetype(teamName: string, direction: string): Archetype {
  const normalizedTeam = normalizeText(teamName);
  const normalizedDirection = normalizeText(direction);

  if (normalizedTeam.includes("vente entreprise")) return "sales-enterprise";
  if (normalizedTeam.includes("vente grand public")) return "sales-retail";
  if (normalizedTeam.includes("finance")) return "finance";
  if (normalizedTeam.includes("marketing")) return "marketing";
  if (normalizedTeam.includes("relation client")) return "customer-service";
  if (normalizedTeam === "rh" || normalizedTeam.includes("ressources humaines")) return "hr";
  if (normalizedTeam.includes("secretariat") || normalizedTeam.includes("secratariat")) {
    return "governance";
  }
  if (normalizedTeam.includes("technique") || normalizedTeam.includes("reseau")) return "network";
  if (normalizedTeam.includes("systeme informatique")) return "it";
  if (normalizedTeam.includes("orange money")) return "fintech";
  if (normalizedTeam.includes("relation exterieure") || normalizedTeam.includes("rse")) {
    return "external";
  }
  if (normalizedTeam.includes("strategie") || normalizedTeam.includes("transformation")) {
    return "strategy";
  }
  if (normalizedTeam === "dg" || normalizedDirection === "dg") return "executive";
  return "operations";
}

function buildFictionOverlay(archetype: Archetype): FictionOverlay {
  switch (archetype) {
    case "executive":
      return {
        scenarioTitle: "Le bunker decide qui coupe le fil rouge",
        atmosphere:
          "Dans le bunker, tous les voyants restent officiellement verts. Officieusement, chacun verifie discretement si l'issue de secours est bien derriere lui.",
        situation:
          "Votre cellule recueille des infos qui se contredisent avec beaucoup trop d'assurance. Vous devez choisir entre verrouiller brutalement le centre de commandement ou laisser chaque faction improviser sa parade jusqu'au prochain choc.",
        options: [
          {
            id: "A",
            title: "Refermer le bunker",
            description:
              "Rassembler une mini-cellule, couper les initiatives freestyle et imposer une seule voix avant que la mission devienne un theatre d'impro."
          },
          {
            id: "B",
            title: "Laisser chaque faction tenter son coup",
            description:
              "Donner du champ a chaque clan pour bricoler sa propre reponse, puis comparer ce qui tient encore debout."
          }
        ],
        rationale:
          "Les indices fiables pointent surtout un risque de cacophonie. Ici, le bon coup n'est pas le plus spectaculaire: c'est celui qui evite que cinq films differents se lancent en meme temps."
      };
    case "sales-enterprise":
      return {
        scenarioTitle: "Casino flottant, mallette camouflee et encheres menteuses",
        atmosphere:
          "Le paquebot-casino ressemble a un decor de film qui aurait gagne trop d'argent. Chaque table brille juste assez pour cacher une autre table, et chaque sourire a probablement deja ete repeint trois fois.",
        situation:
          "Pendant une vente aux encheres truquee, une mallette cryptee doit changer de proprietaire deux fois avant de filer vers un coffre champagne. Vous devez choisir entre remplacer la mallette par un faux exemplaire au beau milieu de la salle, ou laisser l'echange complet se jouer pour suivre le vrai convoyeur jusqu'au coffre reserve.",
        options: [
          {
            id: "A",
            title: "Swapper la mallette en plein numero",
            description:
              "Faire entrer un faux briefcase dans la danse, couper l'elegance de la soiree et miser sur un moment de confusion parfaitement choregraphie."
          },
          {
            id: "B",
            title: "Laisser le ballet finir pour remonter au coffre",
            description:
              "Supporter dix minutes de theatre supplementaires, baliser trois convoyeurs et n'intervenir qu'une fois la vraie route du coffre revelee."
          }
        ],
        rationale:
          "Les indices fiables montrent qu'un swap trop tot a de fortes chances de toucher la mauvaise mallette ou le mauvais porteur. Ici, la vraie victoire n'est pas d'agir vite, c'est d'agir sur le dernier bon maillon."
      };
    case "sales-retail":
      return {
        scenarioTitle: "Parc Eclipse, mascottes toxiques et mallette a la grande roue",
        atmosphere:
          "Le parc chante, clignote et colle aux chaussures. Au milieu des mascottes, quelqu'un a eu l'idee tres discutable d'organiser une remise clandestine pendant la parade familiale.",
        situation:
          "La mallette doit transiter entre une mascotte astronaute et un faux technicien juste avant le feu d'artifice. Vous devez choisir entre declencher une alerte enfant perdu pour figer tout le parc, ou pirater la rotation des mascottes afin d'observer quel costume file vers les tunnels de service.",
        options: [
          {
            id: "A",
            title: "Geler le parc avec une alerte generale",
            description:
              "Faire sonner l'alerte, vider les allees principales et tenter d'arracher la mallette avant que la foule ne se transforme en nuage de confusion."
          },
          {
            id: "B",
            title: "Laisser la parade vivre et truquer les mascottes",
            description:
              "Modifier les rotations des costumes, suivre les coulisses et refermer seulement les tunnels de service quand le bon costume s'y engage."
          }
        ],
        rationale:
          "Les indices fiables montrent que l'alerte générale créerait surtout un brouillard parfait pour la mauvaise mascotte. Le bon move consiste a laisser le decor vivre juste assez pour que le vrai costume s'isole tout seul."
      };
    case "finance":
      return {
        scenarioTitle: "Le coffre fait du parkour de toit en toit",
        atmosphere:
          "Le coffre n'est pas vide, mais il a clairement arrete de marcher calmement. Chaque sortie de jetons est defendue comme une question de survie absolue, ce qui est rarement bon signe.",
        situation:
          "Votre escouade surveille une reserve de jetons qui commence a fondre alors que chacun arrive avec sa meilleure excuse et son plus beau regard dramatique. Vous devez choisir entre sortir le coupe-circuit du coffre ou croire tres fort au self-control collectif.",
        options: [
          {
            id: "A",
            title: "Sortir le coupe-circuit du coffre",
            description:
              "Geler ce qui n'est pas vital, reprendre son souffle et regarder quelles urgences survivent encore quand les projecteurs s'eteignent."
          },
          {
            id: "B",
            title: "Croire au self-control heroique",
            description:
              "Laisser chaque clan jurer qu'il deviendra soudain raisonnable avec les jetons communs."
          }
        ],
        rationale:
          "Les indices fiables montrent surtout un coffre qui glisse et trop de belles histoires pour le justifier. Dans ce decor, faire confiance a la sagesse spontanee ressemble beaucoup a laisser un buffet ouvert a des pirates affames."
      };
    case "marketing":
      return {
        scenarioTitle: "Carnaval Mirage, phrase-code piegee et canons a confettis pirates",
        atmosphere:
          "Le carnaval a la politesse d'etre beaucoup trop brillant pour etre honnete. Chaque char a l'air important et exactement la moitie d'entre eux veulent vous manipuler.",
        situation:
          "Un contact doit activer un reseau dormant en prononcant une phrase-code sur la scene aux miroirs. Vous devez choisir entre diffuser votre propre phrase avant lui pour faire bouger tout le monde, ou laisser le premier mot sortir afin de repérer quel clan le relaie vraiment au lieu de simplement l'applaudir.",
        options: [
          {
            id: "A",
            title: "Parler en premier via les canons pirates",
            description:
              "Lancer votre version du code depuis les canons a confettis et miser sur une réaction immédiate des cellules cachées."
          },
          {
            id: "B",
            title: "Ecouter le premier echo avant de repondre",
            description:
              "Observer quel char pivote, quelle tribune se réveille et quel groupe reprend la phrase avec un peu trop d'empressement avant d'injecter votre propre signal."
          }
        ],
        rationale:
          "Les indices fiables montrent que parler en premier reveillerait surtout tous les imitateurs du carnaval. Ici, il faut d'abord laisser sortir la vraie musique pour savoir qui danse vraiment dessus."
      };
    case "customer-service":
      return {
        scenarioTitle: "La radio d'urgence passe en cocotte-minute",
        atmosphere:
          "Les operateurs tiennent encore le micro, mais on sent que le prochain appel un peu trop epice peut transformer la salle en emission de survie sans pause pub.",
        situation:
          "Votre escouade gere une radio d'urgence ou les messages s'accumulent, certains dossiers collent aux doigts et les voyageurs ont deja entendu trois versions de la meme consigne. Vous devez choisir entre garder la petite musique commerciale ou mettre tout le monde en mode sauvetage express.",
        options: [
          {
            id: "A",
            title: "Continuer les ventes en serrant les dents",
            description:
              "Maintenir les petits bonus commerciaux et demander un dernier effort heroique au central."
          },
          {
            id: "B",
            title: "Passer 72h en mode sauvetage express",
            description:
              "Mettre les ventes annexes au frigo, vider les dossiers sensibles et recoller une parole claire."
          }
        ],
        rationale:
          "Les indices fiables montrent que la salle peut encore etre sauvee, mais pas si on lui demande de vendre pendant qu'elle recoud les degats."
      };
    case "hr":
      return {
        scenarioTitle: "Le camp de base tire sur la corde",
        atmosphere:
          "Dans le camp, personne ne s'effondre avec panache. C'est plus sournois: les sourires restent polis pendant que les batteries humaines clignotent toutes en meme temps.",
        situation:
          "Votre escouade conduit une expedition qui avance vite, mais plusieurs membres de l'equipage jonglent deja avec trop de sacs, trop de cartes et trop peu d'air. Vous devez choisir entre garder le turbo heroique ou offrir une vraie respiration avant que quelqu'un plante son drapeau dans la mauvaise montagne.",
        options: [
          {
            id: "A",
            title: "Garder le turbo et compter sur le mental",
            description:
              "Tenir le rythme, afficher de la determination et laisser les chefs de camp absorber le choc."
          },
          {
            id: "B",
            title: "Donner de l'air au camp avant d'accelerer",
            description:
              "Repartir la charge, proteger les zones les plus exposees et relancer ensuite avec un equipage encore capable de lire la carte."
          }
        ],
        rationale:
          "Les indices fiables montrent une fatigue reelle et un risque de casse silencieuse. Continuer au meme rythme reviendrait a confondre courage et entetement."
      };
    case "governance":
      return {
        scenarioTitle: "Salle des sceaux, faux dignitaire et derniere rune venimeuse",
        atmosphere:
          "La salle sent la cire, le velours et le mensonge ancien. Tout a l'air parfaitement en ordre, ce qui dans ce type de palais reste une excellente raison de devenir mefiant.",
        situation:
          "Un faux dignitaire pourrait poser le sceau noir pendant une ceremonie ultra codifiee. Vous devez choisir entre remplacer le sceau par un leurre pour provoquer une reaction immediate, ou laisser la ceremonie aller jusqu'a la derniere rune pour voir qui hesite quand le faux protocole devient vraiment dangereux.",
        options: [
          {
            id: "A",
            title: "Poser un leurre de sceau et provoquer le faux",
            description:
              "Modifier discrètement le sceau, déclencher un incident de rite et espérer que le mauvais dignitaire se trahisse immédiatement."
          },
          {
            id: "B",
            title: "Laisser la derniere rune faire craquer le masque",
            description:
              "Tenir vos nerfs, observer les gestes sacrés et intervenir seulement quand le faux dignitaire devra improviser sur la rune finale."
          }
        ],
        rationale:
          "Les indices fiables montrent qu'un leurre trop tot ferait surtout paniquer tout le palais sans garantir le bon coupable. Ici, la mise en scène la plus utile est celle qui laisse le mauvais acteur rater son texte au pire moment."
      };
    case "network":
      return {
        scenarioTitle: "Citadelle Nox, faux drone et bypass de la nuit rouge",
        atmosphere:
          "La citadelle flotte comme une reine qui refuse de tousser devant la cour. Le souci, c'est que son cœur énergétique a déjà commencé à mentir avec beaucoup trop de charme.",
        situation:
          "Un drone de maintenance fantome essaiera de toucher la ligne de refroidissement pendant la nuit rouge. Vous devez choisir entre ouvrir une purge orbitale pour lui couper toute fenêtre d'amarrage, ou diffuser de faux voyants stables afin de forcer la taupe interne a tenter le bypass manuel sous vos yeux.",
        options: [
          {
            id: "A",
            title: "Lancer la purge orbitale avant l'amarrage",
            description:
              "Dépressuriser la ligne, faire rugir les alarmes et assumer un gros choc visible pour fermer toutes les trappes au drone fantôme."
          },
          {
            id: "B",
            title: "Jouer le faux calme pour ferrer la taupe",
            description:
              "Faire croire que tout se stabilise, surveiller les accès manuels et attendre que la vraie taupe interne cherche elle-même le bypass."
          }
        ],
        rationale:
          "Les indices fiables montrent qu'une purge totale traite le symptome sans dévoiler la vraie main. La meilleure lecture consiste à accepter un faux calme millimétré pour faire sortir la taupe, pas seulement le drone."
      };
    case "it":
      return {
        scenarioTitle: "Laboratoire des glitches, mimic vocal et portail appat",
        atmosphere:
          "Le laboratoire fait semblant d'etre logique, ce qui est toujours un peu vexant quand une IA imitatrice y joue deja au fantome. Les consoles clignotent comme si elles savaient quelque chose qu'elles ne diraient qu'a contrecœur.",
        situation:
          "Une IA imitatrice s'amuse à copier des voix d'accès autour du portail principal. Vous devez choisir entre créer un faux portail-appât qui l'obligera à se matérialiser dans une cage de logs, ou couper tout un aile du labo et faire passer la livraison en mode manuel quasi-analogue.",
        options: [
          {
            id: "A",
            title: "Construire un portail-appat pour la faire mordre",
            description:
              "Monter un sas leurre, accepter une ouverture piégée et espérer capturer l'IA entière au lieu de simplement lui fermer la porte au nez."
          },
          {
            id: "B",
            title: "Couper une aile et livrer en mode quasi-analogue",
            description:
              "Mettre tout le labo en sueur, faire passer la livraison par un couloir manuel et miser sur un blackout propre plutôt que sur un piège intelligent."
          }
        ],
        rationale:
          "Les indices fiables montrent que l'IA adore profiter des coupures brutales pour se dissoudre ailleurs. Ici, le meilleur coup consiste a lui donner une fausse porte irresistible et a la capturer complete, pas seulement a la faire fuir."
      };
    case "fintech":
      return {
        scenarioTitle: "Marche noir des jetons, lot contrefait et roi des mules",
        atmosphere:
          "Le marché noir bruisse de capes, de capuches et de promesses parfaitement invérifiables. Tout y parait fluide, donc tout mérite probablement d'être contrôlé deux fois.",
        situation:
          "Le roi des mules doit faire circuler une série de jetons ce soir pour nettoyer sa piste. Vous devez choisir entre injecter un lot contrefait balisé pour suivre les receleurs jusqu'au sommet, ou provoquer une mini-panique de liquidité afin de voir qui vide ses poches vers la porte froide.",
        options: [
          {
            id: "A",
            title: "Injecter le lot contrefait balise",
            description:
              "Laisser circuler un faux lot extrêmement bien maquillé pour taguer les receleurs et remonter la chaîne sans fermer le marché."
          },
          {
            id: "B",
            title: "Declencher une mini-panique de liquidite",
            description:
              "Faire croire a un manque de jetons, observer qui vide les caisses en catastrophe et courir après les silhouettes qui fuient le plus vite."
          }
        ],
        rationale:
          "Les indices fiables montrent qu'une panique de liquidité créerait un chaos trop large et trop peu lisible. Le faux lot balisé est plus lent, mais il donne une piste exploitable jusqu'au vrai sommet."
      };
    case "external":
      return {
        scenarioTitle: "Gala Orion, alliance de cristal et photo sous anesthesie",
        atmosphere:
          "Le gala sent le parfum cher, la diplomatie en vitrine et le mensonge qui a pris rendez-vous avec les projecteurs. Toute personne trop elegante devient automatiquement un suspect raisonnable.",
        situation:
          "L'alliance de cristal doit etre exhibee pendant la photo de minuit. Vous devez choisir entre remplacer l'alliance par un decoy parfait avant le toast, ou laisser la vraie piece sortir sous flash pour repérer qui tente de la rejoindre au moment exact où la salle se fige.",
        options: [
          {
            id: "A",
            title: "Swapper l'alliance avant la photo",
            description:
              "Poser un decoy avant le toast, surveiller les réactions et espérer que le voleur se jette sur la mauvaise pièce."
          },
          {
            id: "B",
            title: "Laisser le cristal sortir pour voir qui plonge",
            description:
              "Tenir la salle, attendre le vrai flash et refermer le rideau au moment précis où quelqu'un oubliera son rôle pour se rapprocher du cristal."
          }
        ],
        rationale:
          "Les indices fiables montrent qu'un decoy trop tôt risque surtout de faire mordre le mauvais invité. La vraie faille apparait lorsque la pièce authentique touche enfin la lumière et que le bon masque s'autorise un faux pas."
      };
    case "strategy":
      return {
        scenarioTitle: "Caravane des six portes, fausses cartes et eclaireurs nerveux",
        atmosphere:
          "La grande carte est superbe, donc possiblement criminelle. Dans les caravanes serieuses, on se mefie toujours un peu des documents trop photogeniques.",
        situation:
          "Six portes s'offrent a la caravane, mais deux cartes contradictoires circulent deja dans le camp. Vous devez choisir entre envoyer deux équipes d'eclaireurs avec des cartes volontairement fausses pour voir quelle porte tente de les aspirer, ou brûler un pont logistique pour forcer tout le convoi sur deux passages seulement et observer qui proteste le plus vite.",
        options: [
          {
            id: "A",
            title: "Envoyer deux fausses cartes comme appat",
            description:
              "Sacrifier un peu de contrôle, lancer deux éclaireurs avec de mauvais plans et voir quelle porte se comporte comme si elle les attendait."
          },
          {
            id: "B",
            title: "Bruler un pont et comprimer tout le convoi",
            description:
              "Réduire les choix, accepter une belle pression logistique et forcer le vrai guide menteur à s'énerver publiquement."
          }
        ],
        rationale:
          "Les indices fiables montrent qu'un convoi compressé devient trop dépendant d'une seule lecture, même surveillée. Les fausses cartes créent davantage de bruit, mais elles révèlent mieux quelle porte attend réellement qu'on s'y jette."
      };
    case "operations":
      return {
        scenarioTitle: "Train fantome Carmin, faux conducteur et badge qui bouge tout seul",
        atmosphere:
          "Le train chante faux, les wagons grincent et la locomotive insiste lourdement sur le fait que tout va tres bien. C'est le genre de decor ou un badge de conducteur peut changer de poche sans prevenir personne.",
        situation:
          "Le conducteur officiel a peut-être déjà été remplacé, et deux badges de cabine circulent dans la rame. Vous devez choisir entre subtiliser un badge et voir qui tente de rejoindre la mauvaise cabine, ou décrocher deux wagons suspects pour pousser le saboteur à déclencher lui-même le levier d'urgence.",
        options: [
          {
            id: "A",
            title: "Voler un badge et pieger la cabine",
            description:
              "Créer une confusion contrôlée autour des badges de cabine et observer qui se trahit en courant vers le mauvais poste de pilotage."
          },
          {
            id: "B",
            title: "Larguer deux wagons pour faire parler le levier",
            description:
              "Sacrifier une partie de la rame, modifier l'équilibre du train et miser sur un sabotage trop pressé pour rester discret."
          }
        ],
        rationale:
          "Les indices fiables montrent que le nœud du piège est davantage dans la cabine que dans les wagons eux-mêmes. Le badge volé fait émerger le vrai imposteur plus proprement qu'un largage de wagons trop spectaculaire."
      };
  }
}

function getFictionCardTone(archetype: Archetype): FictionCardTone {
  switch (archetype) {
    case "network":
    case "it":
      return {
        headlineLeads: [
          "Alerte de la salle des machines:",
          "Message intercepte sur le pont technique:",
          "Grincement venu d'un couloir tres mal eclaire:"
        ],
        headlineStings: ["edition citadelle", "niveau radar", "a ne pas lire a voix trop haute"],
        bodyLeads: [
          "Dans les couloirs techniques, on raconte ceci:",
          "Sur les ecrans du central, le detail apparait ainsi:",
          "Version recuperee pres de la console principale:"
        ],
        bodyHooks: [
          "Ce genre de detail fait basculer une station entiere du cote des sueurs froides.",
          "Place au bon moment, ce signal change l'ambiance de 'controlee' a 'oh'.",
          "Le vrai talent ici consiste a sentir si on parle d'un bouton d'alarme ou d'un bouton de panique en smoking."
        ],
        shareLeads: [
          "A souffler comme une alerte de pont:",
          "A lancer comme si tu venais juste de voir un voyant clignoter:",
          "A glisser avec l'air de quelqu'un qui prefere ne pas etre la quand ca saute:"
        ],
        shareClosers: [
          "Puis laisse la salle imaginer le bruit que ferait une panne au pire moment.",
          "Observe qui fait semblant de ne pas entendre le mot 'avarie'.",
          "Si quelqu'un sourit trop vite, note-le mentalement."
        ]
      };
    case "sales-retail":
    case "marketing":
    case "external":
      return {
        headlineLeads: [
          "Rumeur entendue derriere les coulisses:",
          "Annonce qui brille un peu trop:",
          "Petit murmure du carnaval:"
        ],
        headlineStings: ["edition tapis rouge", "a sortir sous les projecteurs", "version coulisses"],
        bodyLeads: [
          "Dans les coulisses, la version la plus croustillante ressemble a ceci:",
          "Parmi les confettis et les sourires forces, on entend surtout ca:",
          "Si on ecoute derriere le rideau, le decor raconte plutot ceci:"
        ],
        bodyHooks: [
          "Dit avec un petit sourire, ce point peut faire basculer tout le casting.",
          "C'est le genre d'info qui retourne une salle entiere sans jamais hausser la voix.",
          "Bien lance, ce morceau-la change un beau show en excellent nid a soupcons."
        ],
        shareLeads: [
          "A lacher comme une confidence de coulisses:",
          "A sortir juste avant que tout le monde applaudisse trop vite:",
          "A glisser avec un demi-sourire, comme si tu etais tres mal informe alors que pas du tout:"
        ],
        shareClosers: [
          "Puis regarde qui prefere sauver le show plutot que la mission.",
          "Laisse planer l'idee qu'un feu d'artifice peut aussi eclairer un desastre.",
          "Et savoure le petit silence qui suit."
        ]
      };
    case "finance":
    case "fintech":
      return {
        headlineLeads: [
          "Murmure entendu pres du coffre:",
          "Jeton retrouve sur le tapis:",
          "Rumeur qui circule chez les gardiens du coffre:"
        ],
        headlineStings: ["edition coffre", "a compter deux fois", "odeur de faux calme"],
        bodyLeads: [
          "Version entendue a deux pas du coffre principal:",
          "Quand on compte les jetons sans cligner, voici ce qui apparait:",
          "Les gardiens du coffre racontent plutot ceci:"
        ],
        bodyHooks: [
          "Le mot 'tranquille' est rarement de bon augure a deux metres d'un coffre nerveux.",
          "Ce signal a la tete d'un detail et le potentiel d'une tres mauvaise nuit.",
          "Au bon moment, cette info peut faire tomber plusieurs jolis discours d'un seul coup."
        ],
        shareLeads: [
          "A glisser comme si tu parlais d'une toute petite fuite:",
          "A sortir avec la voix de quelqu'un qui a vu le coffre se vider un peu trop vite:",
          "A lancer en regardant qui serre soudain son sac contre lui:"
        ],
        shareClosers: [
          "Puis attends de voir qui jure que tout est vital.",
          "Si quelqu'un promet que ca se reglera tout seul, laisse-le finir avant de sourire.",
          "Et note qui devient soudain tres philosophe sur le mot 'plus tard'."
        ]
      };
    default:
      return {
        headlineLeads: cardHeadlineLeads,
        headlineStings: cardHeadlineStings,
        bodyLeads: [
          "Dans les coulisses de la mission, la version qui circule ressemble a ceci:",
          "Ce que l'on murmure juste avant que tout le monde panique ressemble plutot a ca:",
          "Version recueillie dans un coin ou personne ne parlait assez bas:"
        ],
        bodyHooks: [
          "Bien place, ce signal peut retourner toute la table en une phrase.",
          "C'est exactement le genre d'info qui fait lever un sourcil, puis changer trois votes.",
          "Au bon moment, ce point peut semer un doute tres productif.",
          "La bonne personne, au bon moment, peut transformer ce detail en mini-seisme.",
          "Dit avec assez d'assurance, ce morceau-la peut faire tanguer tout le groupe."
        ],
        shareLeads: sharePromptLeads,
        shareClosers: sharePromptClosers
      };
  }
}

function applyTextReplacements(text: string, replacements: TextReplacement[]): string {
  return replacements.reduce(
    (currentText, { pattern, replacement }) => currentText.replace(pattern, replacement),
    text
  );
}

function getFictionReplacements(archetype: Archetype): TextReplacement[] {
  switch (archetype) {
    case "executive":
      return [
        { pattern: /\bdirections\b/gi, replacement: "factions" },
        { pattern: /\bdirection\b/gi, replacement: "faction" },
        { pattern: /\bmanagers\b/gi, replacement: "lieutenants" },
        { pattern: /\bmanager\b/gi, replacement: "lieutenant" },
        { pattern: /\bpartenaire\b/gi, replacement: "allie de couloir" },
        { pattern: /\bbudget de crise\b/gi, replacement: "caisse d'urgence du bunker" }
      ];
    case "sales-enterprise":
      return [
        { pattern: /\bclients\b/gi, replacement: "gros joueurs" },
        { pattern: /\bclient\b/gi, replacement: "gros joueur" },
        { pattern: /\bcommerciaux\b/gi, replacement: "croupiers d'elite" },
        { pattern: /\bcommercial\b/gi, replacement: "croupier d'elite" },
        { pattern: /\bcomptes\b/gi, replacement: "tables VIP" },
        { pattern: /\bcompte\b/gi, replacement: "table VIP" },
        { pattern: /\bdossiers\b/gi, replacement: "tables chaudes" },
        { pattern: /\bdossier\b/gi, replacement: "table chaude" },
        { pattern: /\bpipeline\b/gi, replacement: "salle des tables" },
        { pattern: /\bpipe\b/gi, replacement: "salle des tables" },
        { pattern: /\bmarge\b/gi, replacement: "pile de jetons" },
        { pattern: /\bremises\b/gi, replacement: "jetons bonus" },
        { pattern: /\bremise\b/gi, replacement: "jeton bonus" },
        { pattern: /\bpricing\b/gi, replacement: "gardien des jetons" },
        { pattern: /\bconcurrent\b/gi, replacement: "casino rival" }
      ];
    case "sales-retail":
      return [
        { pattern: /\bpoints de vente\b/gi, replacement: "stands" },
        { pattern: /\bpoint de vente\b/gi, replacement: "stand" },
        { pattern: /\bmagasins\b/gi, replacement: "stands" },
        { pattern: /\bmagasin\b/gi, replacement: "stand" },
        { pattern: /\bclients\b/gi, replacement: "visiteurs" },
        { pattern: /\bclient\b/gi, replacement: "visiteur" },
        { pattern: /\btrafic\b/gi, replacement: "foule" },
        { pattern: /\bconversion\b/gi, replacement: "transformation en butin" },
        { pattern: /\bventes\b/gi, replacement: "prises" },
        { pattern: /\bvente\b/gi, replacement: "prise" },
        { pattern: /\bstock\b/gi, replacement: "reserve de lots" },
        { pattern: /\bruptures\b/gi, replacement: "trous de reserve" },
        { pattern: /\brupture\b/gi, replacement: "trou de reserve" },
        { pattern: /\bcaisse\b/gi, replacement: "comptoir" }
      ];
    case "finance":
      return [
        { pattern: /\btr[eé]sorerie\b/gi, replacement: "coffre" },
        { pattern: /\bcash\b/gi, replacement: "coffre" },
        { pattern: /\bd[eé]penses\b/gi, replacement: "sorties de jetons" },
        { pattern: /\bd[eé]pense\b/gi, replacement: "sortie de jetons" },
        { pattern: /\bbudget\b/gi, replacement: "reserve de jetons" },
        { pattern: /\bencaissements\b/gi, replacement: "entrees de jetons" },
        { pattern: /\bencaissement\b/gi, replacement: "entree de jetons" },
        { pattern: /\bfournisseurs\b/gi, replacement: "marchands du port" },
        { pattern: /\bfournisseur\b/gi, replacement: "marchand du port" },
        { pattern: /\bdirections\b/gi, replacement: "clans" },
        { pattern: /\bdirection\b/gi, replacement: "clan" }
      ];
    case "marketing":
      return [
        { pattern: /\bcampagnes\b/gi, replacement: "parades" },
        { pattern: /\bcampagne\b/gi, replacement: "parade" },
        { pattern: /\bleads\b/gi, replacement: "curieux" },
        { pattern: /\blead\b/gi, replacement: "curieux" },
        { pattern: /\bpromesse\b/gi, replacement: "grand numero annonce" },
        { pattern: /\bciblage\b/gi, replacement: "mire a confettis" },
        { pattern: /\bterrain\b/gi, replacement: "coulisses" },
        { pattern: /\baudiences\b/gi, replacement: "tribunes" },
        { pattern: /\baudience\b/gi, replacement: "tribune" },
        { pattern: /\bbudget m[eé]dia\b/gi, replacement: "reserve de confettis" }
      ];
    case "customer-service":
      return [
        { pattern: /\bclients\b/gi, replacement: "voyageurs" },
        { pattern: /\bclient\b/gi, replacement: "voyageur" },
        { pattern: /\bbacklog\b/gi, replacement: "pile de SOS" },
        { pattern: /\btickets\b/gi, replacement: "messages SOS" },
        { pattern: /\bticket\b/gi, replacement: "message SOS" },
        { pattern: /\bdossiers\b/gi, replacement: "messages collants" },
        { pattern: /\bdossier\b/gi, replacement: "message collant" },
        { pattern: /\bconseillers\b/gi, replacement: "operateurs" },
        { pattern: /\bconseiller\b/gi, replacement: "operateur" },
        { pattern: /\bcanaux\b/gi, replacement: "frequences" },
        { pattern: /\bcanal\b/gi, replacement: "frequence" },
        { pattern: /\bupsell\b/gi, replacement: "vente de gadgets" },
        { pattern: /\bplateau\b/gi, replacement: "central" }
      ];
    case "hr":
      return [
        { pattern: /\b[eé]quipes\b/gi, replacement: "equipages" },
        { pattern: /\b[eé]quipe\b/gi, replacement: "equipage" },
        { pattern: /\bmanagers\b/gi, replacement: "chefs de camp" },
        { pattern: /\bmanager\b/gi, replacement: "chef de camp" },
        { pattern: /\btransformation\b/gi, replacement: "expedition" },
        { pattern: /\bturnover\b/gi, replacement: "envie de quitter le camp" },
        { pattern: /\beffectifs\b/gi, replacement: "effectifs d'equipage" },
        { pattern: /\beffectif\b/gi, replacement: "effectif d'equipage" },
        { pattern: /\bcharge\b/gi, replacement: "charge de sacs" },
        { pattern: /\brenforts\b/gi, replacement: "porteurs de secours" },
        { pattern: /\brenfort\b/gi, replacement: "porteur de secours" }
      ];
    case "governance":
      return [
        { pattern: /\bdossier contractuel\b/gi, replacement: "parchemin a sceller" },
        { pattern: /\bdossiers contractuels\b/gi, replacement: "parchemins a sceller" },
        { pattern: /\bdossier\b/gi, replacement: "parchemin" },
        { pattern: /\bdossiers\b/gi, replacement: "parchemins" },
        { pattern: /\bclauses\b/gi, replacement: "runes" },
        { pattern: /\bclause\b/gi, replacement: "rune" },
        { pattern: /\bsigner\b/gi, replacement: "poser le sceau" },
        { pattern: /\bsignature\b/gi, replacement: "pose du sceau" },
        { pattern: /\bpartenaire\b/gi, replacement: "royaume voisin" },
        { pattern: /\bvalidation juridique\b/gi, replacement: "sceau des gardiens" }
      ];
    case "strategy":
      return [
        { pattern: /\bplan\b/gi, replacement: "carte au tresor" },
        { pattern: /\bd[eé]ploiement\b/gi, replacement: "grande tournee" },
        { pattern: /\bentit[eé]s\b/gi, replacement: "escales" },
        { pattern: /\bentit[eé]\b/gi, replacement: "escale" },
        { pattern: /\btransformation\b/gi, replacement: "expedition" },
        { pattern: /\bsponsors\b/gi, replacement: "eclaireurs" },
        { pattern: /\bsponsor\b/gi, replacement: "eclaireur" },
        { pattern: /\bterrain\b/gi, replacement: "caravane" },
        { pattern: /\bpilote\b/gi, replacement: "galop d'essai" },
        { pattern: /\bgains\b/gi, replacement: "butins" },
        { pattern: /\bgain\b/gi, replacement: "butin" }
      ];
    case "network":
      return [
        { pattern: /\br[eé]seau\b/gi, replacement: "citadelle" },
        { pattern: /\bmaintenance\b/gi, replacement: "ouverture de soute" },
        { pattern: /\bsupervision\b/gi, replacement: "vigie radar" },
        { pattern: /\bincidents\b/gi, replacement: "secousses" },
        { pattern: /\bincident\b/gi, replacement: "secousse" },
        { pattern: /\banomalie\b/gi, replacement: "avarie" },
        { pattern: /\bcorrectif\b/gi, replacement: "kit de reparation" },
        { pattern: /\btrafic\b/gi, replacement: "circulation" },
        { pattern: /\bclients\b/gi, replacement: "voyageurs" },
        { pattern: /\bclient\b/gi, replacement: "voyageur" },
        { pattern: /\bcharge\b/gi, replacement: "pression orbitale" },
        { pattern: /\bweek-end\b/gi, replacement: "nuit rouge" },
        { pattern: /\btechnique\b/gi, replacement: "de la salle des machines" },
        { pattern: /\bbo[iî]te a outils\b/gi, replacement: "soute a outils" }
      ];
    case "it":
      return [
        { pattern: /\bsyst[eè]me\b/gi, replacement: "laboratoire" },
        { pattern: /\brelease\b/gi, replacement: "ouverture du portail" },
        { pattern: /\bbug\b/gi, replacement: "glitch" },
        { pattern: /\bflux\b/gi, replacement: "conduit" },
        { pattern: /\bd[eé]pendances\b/gi, replacement: "cables fantomes" },
        { pattern: /\bd[eé]pendance\b/gi, replacement: "cable fantome" },
        { pattern: /\bproduction\b/gi, replacement: "grand portail" },
        { pattern: /\bm[eé]tier\b/gi, replacement: "reste de l'equipage" },
        { pattern: /\brework\b/gi, replacement: "grand retour en atelier" },
        { pattern: /\bdette technique\b/gi, replacement: "poussiere de labo" }
      ];
    case "fintech":
      return [
        { pattern: /\bfraude\b/gi, replacement: "pirates de jetons" },
        { pattern: /\butilisateurs\b/gi, replacement: "joueurs" },
        { pattern: /\butilisateur\b/gi, replacement: "joueur" },
        { pattern: /\bcontr[oô]les\b/gi, replacement: "barrages" },
        { pattern: /\bcontr[oô]le\b/gi, replacement: "barrage" },
        { pattern: /\banomalies\b/gi, replacement: "mouvements louches" },
        { pattern: /\banomalie\b/gi, replacement: "mouvement louche" },
        { pattern: /\bvolumes\b/gi, replacement: "flux de jetons" },
        { pattern: /\bvolume\b/gi, replacement: "flux de jetons" },
        { pattern: /\bparcours\b/gi, replacement: "piste" },
        { pattern: /\bpartenaire technique\b/gi, replacement: "allie du marche noir" }
      ];
    case "external":
      return [
        { pattern: /\bpartenariat\b/gi, replacement: "alliance de gala" },
        { pattern: /\bannonce\b/gi, replacement: "photo officielle" },
        { pattern: /\bannonces\b/gi, replacement: "photos officielles" },
        { pattern: /\binterne\b/gi, replacement: "de coulisses" },
        { pattern: /\binternes\b/gi, replacement: "de coulisses" },
        { pattern: /\bexterne\b/gi, replacement: "devant les projecteurs" },
        { pattern: /\bexternes\b/gi, replacement: "devant les projecteurs" },
        { pattern: /\bprojet\b/gi, replacement: "numero de gala" }
      ];
    case "operations":
      return [
        { pattern: /\brisques\b/gi, replacement: "wagons qui grincent" },
        { pattern: /\brisque\b/gi, replacement: "wagon qui grince" },
        { pattern: /\bpriorisation\b/gi, replacement: "choix des wagons" },
        { pattern: /\bzones\b/gi, replacement: "wagons" },
        { pattern: /\bzone\b/gi, replacement: "wagon" },
        { pattern: /\bpoints chauds\b/gi, replacement: "wagons qui fument" },
        { pattern: /\baction\b/gi, replacement: "coup de levier" },
        { pattern: /\bsignaux\b/gi, replacement: "voyants" },
        { pattern: /\bsignal\b/gi, replacement: "voyant" },
        { pattern: /\b[eé]quipes\b/gi, replacement: "escouades" },
        { pattern: /\b[eé]quipe\b/gi, replacement: "escouade" }
      ];
  }
}

function fictionalizeCardCopy(text: string, archetype: Archetype): string {
  const globalReplacements: TextReplacement[] = [
    { pattern: /\bterrain\b/gi, replacement: "decor" },
    { pattern: /\bop[eé]rationnel\b/gi, replacement: "de mission" },
    { pattern: /\bop[eé]rationnelle\b/gi, replacement: "de mission" },
    { pattern: /\bprobl[eè]me\b/gi, replacement: "mini-monstre" },
    { pattern: /\bprobl[eè]mes\b/gi, replacement: "mini-monstres" },
    { pattern: /\bsolution\b/gi, replacement: "move" },
    { pattern: /\bsolutions\b/gi, replacement: "moves" }
  ];

  return applyTextReplacements(
    applyTextReplacements(text, globalReplacements),
    getFictionReplacements(archetype)
  );
}

interface FictionDeckFlavor {
  venue: string;
  asset: string;
  weakPoint: string;
  chaos: string;
  ally: string;
  guard: string;
  timer: string;
  decoy: string;
  passage: string;
  trophy: string;
}

export const GAME_CONTENT_VERSION = 4;

const UNIQUE_TEAM_ARCHETYPES: Archetype[] = [
  "sales-enterprise",
  "network",
  "external",
  "operations",
  "sales-retail",
  "it",
  "fintech",
  "marketing",
  "governance",
  "strategy"
];

function getFictionDeckFlavor(archetype: Archetype): FictionDeckFlavor {
  switch (archetype) {
    case "executive":
      return {
        venue: "le bunker aux neuf ecrans",
        asset: "la cle de commandement",
        weakPoint: "le canal central",
        chaos: "les factions commencent a jouer chacune leur propre film",
        ally: "un lieutenant nerveux",
        guard: "les gardes du sas principal",
        timer: "l'extinction de minuit",
        decoy: "une fausse alerte rouge beaucoup trop bien jouee",
        passage: "le couloir des badges noirs",
        trophy: "la console de commandement"
      };
    case "sales-enterprise":
      return {
        venue: "le casino flottant Saint-Vega",
        asset: "le briefcase a double fond",
        weakPoint: "la ronde des croupiers",
        chaos: "les faux joueurs commencent a se marcher dessus",
        ally: "une chanteuse de salon qui entend tout",
        guard: "les videurs en veste ivoire",
        timer: "la finale du tournoi",
        decoy: "une pluie de jetons bonus inventee par la securite",
        passage: "le couloir reserve aux tables VIP",
        trophy: "la table du grand tapis rouge"
      };
    case "sales-retail":
      return {
        venue: "le parc Eclipse",
        asset: "la mallette cryptee",
        weakPoint: "le tunnel de service sous la grande roue",
        chaos: "les mascottes couvrent deja trop de mouvements suspects",
        ally: "un dresseur de mascottes beaucoup trop calme",
        guard: "les agents en uniforme de parade",
        timer: "le feu d'artifice de 22h",
        decoy: "une annonce geante de loterie instantanee",
        passage: "les couloirs sous les maneges",
        trophy: "la baraque du jackpot"
      };
    case "finance":
      return {
        venue: "la salle du coffre basilic",
        asset: "la reserve de jetons noirs",
        weakPoint: "la trappe laterale du coffre",
        chaos: "les clans viennent deja avec leurs plus beaux discours d'urgence",
        ally: "une gardienne du coffre qui compte tout deux fois",
        guard: "les sentinelles du pont de marbre",
        timer: "la releve de l'aube",
        decoy: "une promesse de camion plein de jetons au lever du jour",
        passage: "la passerelle froide derriere la chambre forte",
        trophy: "le grand coffre a verrou triple"
      };
    case "marketing":
      return {
        venue: "le carnaval Mirage",
        asset: "le masque d'ambre",
        weakPoint: "la coordination des chars lumineux",
        chaos: "les confettis couvrent deja des ordres contradictoires",
        ally: "une costumiere qui voit passer tous les badges",
        guard: "les gardes de parade sur echasses",
        timer: "l'ouverture des projecteurs geants",
        decoy: "une pluie de confettis phosphorescents",
        passage: "les coulisses du char principal",
        trophy: "la scene aux miroirs"
      };
    case "customer-service":
      return {
        venue: "la station-radio Atlas",
        asset: "le carnet des codes de sauvetage",
        weakPoint: "le tri des messages urgents",
        chaos: "les voyageurs recoivent deja trop de versions differentes de la meme consigne",
        ally: "une operatrice qui retient toutes les voix",
        guard: "les sentinelles du central",
        timer: "la prochaine vague de SOS",
        decoy: "une annonce commerciale qui sent le mauvais timing a plein nez",
        passage: "le canal prioritaire du central",
        trophy: "la console des appels critiques"
      };
    case "hr":
      return {
        venue: "le camp de base Helios",
        asset: "la boussole de l'expedition",
        weakPoint: "les epaules des porteurs de tete",
        chaos: "les equipages sourient encore mais commencent a charger leurs sacs de travers",
        ally: "une eclaireuse qui entend les mutineries avant tout le monde",
        guard: "les chefs de camp de nuit",
        timer: "le depart au lever du brouillard",
        decoy: "un discours heroique sur le mental qui resout tout",
        passage: "le sentier bas entre les tentes rouges",
        trophy: "la carte de route des sommets"
      };
    case "governance":
      return {
        venue: "la salle des sceaux interdits",
        asset: "le parchemin au sceau noir",
        weakPoint: "les runes en bas de page",
        chaos: "plusieurs royaumes font semblant d'avoir deja tout relu",
        ally: "une archiviste qui ne rate jamais une rature",
        guard: "les gardiens de cire bleue",
        timer: "le banquet diplomatique",
        decoy: "une rumeur de signature deja benie par tout le palais",
        passage: "la galerie des archives froides",
        trophy: "la table des sceaux"
      };
    case "network":
      return {
        venue: "la citadelle orbitale Nox",
        asset: "le coeur de la grille",
        weakPoint: "la ligne de refroidissement nord",
        chaos: "un seul faux mouvement peut faire rire tres jaune toute la station",
        ally: "une mecanicienne de quart qui connait les bruits suspects par coeur",
        guard: "les gardes du pont radar",
        timer: "la nuit rouge de circulation",
        decoy: "une promesse d'auto-stabilisation sortie du chapeau",
        passage: "la soute laterale sous le pont nord",
        trophy: "la salle des machines"
      };
    case "it":
      return {
        venue: "le laboratoire des glitches",
        asset: "le portail de donnees",
        weakPoint: "le conduit des exceptions",
        chaos: "les faux correctifs attirent deja les mains trop confiantes",
        ally: "un technicien qui parle aux consoles comme a des chiens nerveux",
        guard: "les sentinelles du sas de labo",
        timer: "l'ouverture du grand portail",
        decoy: "un patch miracle tres beau sur la fiche technique",
        passage: "la coursive sous les racks bleus",
        trophy: "la console centrale du labo"
      };
    case "fintech":
      return {
        venue: "le marche noir des jetons",
        asset: "la reserve des clefs de transaction",
        weakPoint: "les barrages du couloir ouest",
        chaos: "les pirates de jetons testent deja vos limites avec un grand sourire",
        ally: "une courtiere qui repere les faux joueurs a leurs chaussures",
        guard: "les sentinelles du marche couvert",
        timer: "la grande affluence de l'aube",
        decoy: "un grand discours sur la fluidite absolue",
        passage: "l'allee froide derriere les comptoirs",
        trophy: "la table des jetons brules"
      };
    case "external":
      return {
        venue: "le gala masque Orion",
        asset: "l'alliance de cristal",
        weakPoint: "les coulisses de la photo officielle",
        chaos: "les projecteurs pourraient tres bien eclairer surtout le decor qui bouge",
        ally: "un maitre d'hotel qui connait tous les secrets de table",
        guard: "les gardes en gants blancs",
        timer: "la photo de minuit",
        decoy: "une photo officielle parfaite mais beaucoup trop precoce",
        passage: "l'escalier de service derriere la salle des miroirs",
        trophy: "la scene du grand flash"
      };
    case "strategy":
      return {
        venue: "la caravane des cartes au tresor",
        asset: "la carte des six portes",
        weakPoint: "le passage des deux premieres escales",
        chaos: "l'expedition risque de partir dans six directions avant le premier lever de soleil",
        ally: "une cartographe qui deteste les jolies fleches sans mode d'emploi",
        guard: "les sentinelles du camp d'etape",
        timer: "la grande traversee de demain",
        decoy: "un discours splendide sur l'evidence du plan",
        passage: "la piste d'essai entre les deux oasis",
        trophy: "le compas du capitaine"
      };
    case "operations":
      return {
        venue: "le train fantome Carmin",
        asset: "le levier des wagons",
        weakPoint: "les trois wagons qui grincent deja",
        chaos: "tout le monde parle plus vite que la locomotive ne pense",
        ally: "une controleuse qui sait exactement quel wagon ment",
        guard: "les sentinelles du wagon tete",
        timer: "l'entree dans le tunnel final",
        decoy: "un grand geste spectaculaire qui rassure surtout les spectateurs",
        passage: "la coursive entre les wagons 4 et 5",
        trophy: "la cabine du levier principal"
      };
  }
}

function buildFictionDecks(
  archetype: Archetype,
  options: [TeamGame["options"][0], TeamGame["options"][1]],
  correctDecision: TeamGame["correctDecision"]
): Record<CardTruth, CardTemplate[]> {
  const flavor = getFictionDeckFlavor(archetype);
  const correctOption = options.find((option) => option.id === correctDecision) ?? options[0];
  const wrongOption = options.find((option) => option.id !== correctDecision) ?? options[1];

  return {
    true: [
      {
        headline: `${flavor.weakPoint} ne tiendra pas jusqu'a ${flavor.timer}`,
        body: `Un reperage discret dans ${flavor.venue} confirme que ${flavor.weakPoint} est bien reel. Si la cellule attend trop, ${flavor.chaos}.`,
        sharePrompt: `Ramene le groupe sur la vraie faille avant que "${wrongOption.title}" paraisse seduisant juste parce qu'il fait du bruit.`,
        adminTruth: "Indice fiable: le point faible et la contrainte de temps sont confirmés."
      },
      {
        headline: `${flavor.ally} confirme aussi le prix a payer pour "${correctOption.title}"`,
        body: `${flavor.ally} ne vend pas du reve: oui, "${correctOption.title}" peut fonctionner, mais il laissera aussi une belle trace, un cout court terme ou une fenetre de stress bien reelle. Rien n'est gratuit dans cette mission.`,
        sharePrompt: `Ajoute de la nuance: la bonne option n'est pas confortable, seulement plus solide quand on accepte son vrai prix.`,
        adminTruth: "Indice fiable: l'option correcte comporte un coût réel, ce qui la rend moins évidente."
      },
      {
        headline: `${flavor.decoy} pousse exactement vers le mauvais move`,
        body: `Tout dans ${flavor.venue} semble avoir ete mis en scene pour rendre "${wrongOption.title}" brillant. C'est pratique, rapide, et probablement ce que le piege attend.`,
        sharePrompt: `Insiste sur le fait que la piste la plus theatrale est justement celle qu'on vous sert sur un plateau.`,
        adminTruth: "Indice fiable: l'option séduisante est surtout renforcée par un leurre."
      },
      {
        headline: `${flavor.guard} rendent aussi "${wrongOption.title}" moins absurde qu'il n'y parait`,
        body: `Le changement de ronde ou la configuration des lieux fait que "${wrongOption.title}" n'est pas une idee ridicule. Dans un monde parfait, ce serait meme tentant. Le souci, c'est que la mission ne se joue pas dans un monde parfait.`,
        sharePrompt: `Fais monter la tension en reconnaissant que la mauvaise option a de vrais arguments, pas juste un joli costume.`,
        adminTruth: "Indice fiable: la mauvaise option a une logique défendable, ce qui augmente l'ambiguïté."
      },
      {
        headline: `${flavor.asset} reste recuperable sans numero suicidaire`,
        body: `La mission n'exige pas un coup spectaculaire. Elle exige surtout d'eviter qu'un detail banal transforme ${flavor.venue} en machine a catastrophes.`,
        sharePrompt: `Rappelle que le bon move n'est pas forcement le plus heroique, juste le plus lucide.`,
        adminTruth: "Indice fiable: un arbitrage sobre et ciblé suffit encore."
      },
      {
        headline: `${flavor.trophy} semble proche, mais l'illusion adore la precipitation`,
        body: `Plusieurs indices convergent, sans raconter une histoire simple. Le vrai danger n'est pas seulement l'exces d'audace; c'est surtout de choisir trop vite un recit qui arrange votre ego.`,
        sharePrompt: `Pose la question qui pique: qu'est-ce qui est vraiment confirme, et qu'est-ce qui nous plait juste parce que ca sonne comme une bonne fin ?`,
        adminTruth: "Indice fiable: la bonne réponse demande de tenir ensemble plusieurs signaux contradictoires."
      }
    ],
    partial: [
      {
        headline: `${flavor.ally} jure que "${wrongOption.title}" peut passer creme`,
        body: `Le ton est convaincant, la source pas ridicule. Il manque juste ce petit detail agaçant qu'aucune preuve solide ne confirme encore sa lecture.`,
        sharePrompt: `Partage-le comme un pari possible, pas comme une carte magique.`,
        adminTruth: "Indice partiel: source crédible mais non confirmée."
      },
      {
        headline: `Une vieille carte montre un raccourci dans ${flavor.venue}`,
        body: `Si le plan est encore valable, ce raccourci peut aider. Si le plan date d'avant la derniere ronde, il envoie surtout l'equipe dans un mur avec beaucoup de style.`,
        sharePrompt: `Garde l'info sur la table, mais sans lui donner plus de poids qu'elle n'en a.`,
        adminTruth: "Indice partiel: possibilité intéressante mais non sécurisée."
      },
      {
        headline: `${flavor.guard} auraient l'air a moitie endormis, mais seulement sur un angle`,
        body: `Un observateur jure avoir vu une faiblesse tres nette. Un second dit l'inverse. Cette divergence est interessante parce qu'elle donne envie d'y croire tout en refusant de se laisser verrouiller.`,
        sharePrompt: `Utilise ce point pour casser les certitudes trop rapides, pas pour fabriquer une conclusion de fortune.`,
        adminTruth: "Indice partiel: observation contradictoire, ambiguïté volontaire."
      },
      {
        headline: `Le public pourrait regarder ailleurs pendant ${flavor.timer}`,
        body: `C'est une belle promesse de couverture. Le probleme, c'est qu'on ne sait pas encore si le decor sera vraiment assez distrait pour vous laisser danser tranquilles.`,
        sharePrompt: `Présente ce point comme une opportunite de couverture, pas comme un bouclier certifie.`,
        adminTruth: "Indice partiel: opportunité possible mais trop floue pour décider seule."
      }
    ],
    false: [
      {
        headline: `"${wrongOption.title}" serait deja pratiquement securise`,
        body: `La phrase circule avec le confort d'une bonne nouvelle gratuite. Malheureusement, elle repose surtout sur de la fumee bien pliee et tres peu sur des faits.`,
        sharePrompt: `Demande qui a vraiment vu cette securisation de ses propres yeux.`,
        adminTruth: "Faux: l'option séduisante n'est pas sécurisée."
      },
      {
        headline: `"${correctOption.title}" declencherait forcement le grand desastre`,
        body: `Le scenario est raconte avec beaucoup d'aplomb et juste assez de details techniques pour paraitre sérieux. Rien, dans les indices consolidés, ne justifie pourtant une certitude aussi dramatique.`,
        sharePrompt: `Resiste aux prophéties trop parfaites: elles ont souvent ete repassees avant d'arriver jusqu'a toi.`,
        adminTruth: "Faux: le scénario catastrophe annoncé est exagéré ou inventé."
      },
      {
        headline: `${flavor.asset} serait deja faux, vide ou ailleurs`,
        body: `Ce récit a tout pour séduire une équipe fatiguée: s'il est vrai, plus besoin de réfléchir. Le souci, c'est qu'aucune source sérieuse ne l'étaye.`,
        sharePrompt: `Si quelqu'un veut enterrer le sujet avec cette histoire, oblige-le a sortir mieux qu'une rumeur bien habillee.`,
        adminTruth: "Faux: la rumeur de faux objectif ou de déplacement est infondée."
      }
    ]
  };
}

function oppositeDecision(value: DecisionOptionId): DecisionOptionId {
  return value === "A" ? "B" : "A";
}

function buildIntruderBrief(team: TeamGame, participantName: string): string {
  const sabotageOption =
    team.options.find((option) => option.id === team.sabotageDecision) ?? team.options[0];
  const safeOption = team.options.find((option) => option.id === team.correctDecision) ?? team.options[0];

  return `${participantName}, tu joues la taupe dans ${team.name}. Ta mission secrète: attirer subtilement l'escouade vers ${sabotageOption.title}, alors que la trajectoire la plus saine reste ${safeOption.title}. Fais monter les beaux récits, donne du poids aux cartes trompeusement rassurantes, laisse les autres conclure a ta place, et surtout ne te fais pas demasquer avant le verdict.`;
}

function assignIntrudersToTeam(team: TeamGame, stableSeed: string): TeamGame {
  const rng = createRng(`intruders-${stableSeed}-${team.id}`);
  const cardByParticipant = new Map(team.cards.map((card) => [card.participantId, card]));
  const participants = shuffleArray([...team.participants], rng);
  const weightedCandidates = participants.map((participant) => {
    const card = cardByParticipant.get(participant.id);
    const truthScore =
      card?.truthType === "false" ? 3 : card?.truthType === "partial" ? 2 : 1;
    return {
      participant,
      card,
      role: resolveRoleLabel(participant),
      truthScore
    };
  });

  weightedCandidates.sort((left, right) => right.truthScore - left.truthScore);

  const picked: typeof weightedCandidates = [];
  for (const candidate of weightedCandidates) {
    if (picked.length === 0) {
      picked.push(candidate);
      continue;
    }

    const roleAlreadyPicked = picked.some((pickedCandidate) => pickedCandidate.role === candidate.role);
    if (!roleAlreadyPicked || picked.length >= 2) {
      picked.push(candidate);
    }

    if (picked.length === 2) {
      break;
    }
  }

  while (picked.length < Math.min(2, weightedCandidates.length)) {
    const nextCandidate = weightedCandidates.find(
      (candidate) => !picked.some((pickedCandidate) => pickedCandidate.participant.id === candidate.participant.id)
    );
    if (!nextCandidate) {
      break;
    }
    picked.push(nextCandidate);
  }

  const intruderIds = picked.map((candidate) => candidate.participant.id);

  return {
    ...team,
    intruderIds,
    sabotageDecision: oppositeDecision(team.correctDecision),
    cards: team.cards.map((card) => ({
      ...card,
      isIntruder: intruderIds.includes(card.participantId),
      sabotageChoice: intruderIds.includes(card.participantId) ? oppositeDecision(team.correctDecision) : null,
      sabotageBrief: intruderIds.includes(card.participantId)
        ? buildIntruderBrief(team, card.participantName)
        : null
    }))
  };
}

function buildScenarioBlueprint(teamName: string, archetype: Archetype): ScenarioBlueprint {
  switch (archetype) {
    case "executive":
      return {
        scenarioTitle: "Qui coupe le fil rouge ?",
        atmosphere:
          "9h08. La cellule de crise a l'energie d'un escape game avec budget illimite: ca parle fort, ca clique partout, et chacun espere que la mauvaise nouvelle choisira quelqu'un d'autre.",
        situation:
          "Des signaux contradictoires remontent de partout. Une partie du terrain jure que tout est gerable, l'autre voit deja le plafond se rapprocher. Vous devez choisir entre sortir le gros bouton rouge pour reprendre la main ou laisser chaque clan bricoler son plan pendant 48h.",
        options: [
          {
            id: "A",
            title: "Sortir le gros bouton rouge",
            description:
              "Former une mini-cellule, couper les initiatives freestyle et verrouiller toute prise de parole avant que la mission parte en impro."
          },
          {
            id: "B",
            title: "Laisser chaque camp bricoler sa parade",
            description:
              "Donner 48h aux directions pour ajuster leur sauce locale et comparer ensuite les plans survivants."
          }
        ],
        correctDecision: "A",
        rationale:
          "Les indices fiables montrent surtout un risque de cacophonie et de domino. Ici, le geste le plus malin n'est pas le plus cool: il faut reprendre la main avant que chacun invente son propre film.",
        decks: {
          true: [
            {
              headline: "Les chiffres consolidés masquent un vrai effet domino",
              body:
                "Trois directions critiques remontent des tensions différentes, mais elles convergent toutes sur le même point: les délais réels explosent dès qu'une validation croisée est requise. Sur le papier, la machine tourne encore; dans les faits, elle commence à tousser.",
              sharePrompt: "Partage ce que tu vois sur le risque systémique plutôt qu'un problème isolé.",
              adminTruth: "Convergence confirmée par plusieurs sources du matin."
            },
            {
              headline: "Les managers intermédiaires filtrent déjà l'information",
              body:
                "Deux arbitrages locaux ont été pris sans escalade complète pour éviter l'emballement. Ce n'est pas de la rétention volontaire, mais cela prouve que la vision du sommet arrive avec retard.",
              sharePrompt: "Insiste sur le décalage entre terrain et niveau décisionnel.",
              adminTruth: "Signal confirmé par les retours croisés des équipes."
            },
            {
              headline: "Le risque réputationnel est surtout lié aux contradictions",
              body:
                "Le plus gros danger n'est pas encore la crise elle-même, mais la probabilité de dire deux choses différentes au même moment. Une prise de parole non alignée ferait plus de dégâts que l'incident actuel.",
              sharePrompt: "Ramène le débat sur le besoin d'une parole unique.",
              adminTruth: "Évaluation confirmée côté direction et communication."
            },
            {
              headline: "La surcharge de décision est déjà visible",
              body:
                "Les mêmes personnes valident, corrigent et rassurent depuis plusieurs jours. Elles tiennent encore, mais la vitesse de décision baisse nettement dès que les sujets se multiplient.",
              sharePrompt: "Souligne que le problème est aussi humain, pas seulement process.",
              adminTruth: "Observation confirmée par les circuits d'arbitrage."
            },
            {
              headline: "Les zones floues sont les plus dangereuses",
              body:
                "Les indicateurs réellement fiables sont peu nombreux mais très cohérents. Ce qui brouille la lecture vient surtout des points encore non consolidés, repris trop vite comme des certitudes.",
              sharePrompt: "Aide l'équipe à séparer le sûr du bruyant.",
              adminTruth: "Diagnostic validé sur les données disponibles."
            },
            {
              headline: "Une décision trop distribuée créerait du patchwork",
              body:
                "Les directions sont capables d'ajuster localement, mais pas toutes à la même vitesse ni avec le même niveau d'information. Si chacune part seule, l'effet collectif sera brouillon dès cet après-midi.",
              sharePrompt: "Pousse l'idée qu'un cap unique vaut mieux que 12 micro-réponses.",
              adminTruth: "Risque confirme dans les simulations d'orchestration."
            }
          ],
          partial: [
            {
              headline: "Un manager affirme que 'ça va se calmer tout seul'",
              body:
                "Selon lui, la tension actuelle vient surtout d'un pic émotionnel de début de semaine. Il n'apporte pas encore d'élément consolidé pour distinguer fatigue passagère et risque durable.",
              sharePrompt: "Présente-le comme une hypothèse, pas comme un fait.",
              adminTruth: "Point de vue isolé, non consolidé."
            },
            {
              headline: "Un sponsor externe serait prêt à patienter",
              body:
                "L'information circule dans deux messages internes, sans validation directe. Si elle est vraie, elle donne un peu d'air; si elle est fausse, elle endort le niveau d'urgence.",
              sharePrompt: "Mets en avant l'incertitude de la source.",
              adminTruth: "Signal plausible, mais aucune confirmation formelle."
            },
            {
              headline: "Le moral des equipes remonterait si quelqu'un tranche vite",
              body:
                "C'est crédible, mais rien ne prouve que la vitesse seule suffira. Une mauvaise décision prise trop vite pourrait produire l'effet inverse.",
              sharePrompt: "Fais la différence entre vitesse et qualité de l'arbitrage.",
              adminTruth: "Effet possible mais non mesuré."
            },
            {
              headline: "Le terrain demande surtout qu'on simplifie les messages",
              body:
                "Plusieurs relais le disent, sans que ce soit objectivé partout. Le besoin de clarté est réel, mais son impact précis sur la situation reste flou.",
              sharePrompt: "À partager comme signal de simplification, pas comme solution miracle.",
              adminTruth: "Indice cohérent, pas encore priorisé."
            }
          ],
          false: [
            {
              headline: "Un partenaire clé aurait déjà perdu confiance",
              body:
                "La rumeur vient d'un transfert oral et a pris de l'ampleur parce qu'elle sonne crédible. Personne n'a produit de trace écrite ni parlé directement au partenaire ce matin.",
              sharePrompt: "Fais attention à ne pas le présenter comme confirmé.",
              adminTruth: "Rumeur non confirmée."
            },
            {
              headline: "Le budget de crise serait déjà validé",
              body:
                "Plusieurs personnes l'ont entendu 'dans un couloir', ce qui rend l'info confortable... et dangereuse. En réalité, aucune validation officielle n'est sortie.",
              sharePrompt: "Prudence maximale sur ce point.",
              adminTruth: "Faux: aucun budget validé à cette heure."
            },
            {
              headline: "Une direction serait prête à prendre seule la main",
              body:
                "Le récit est séduisant parce qu'il simplifie le problème. Les faits montrent plutôt une dépendance croisée entre directions, pas une autonomie héroïque.",
              sharePrompt: "Ne laisse pas un récit simple écraser la complexité réelle.",
              adminTruth: "Faux cadrage, contraire aux données disponibles."
            }
          ]
        }
      };
    case "sales-enterprise":
      return {
        scenarioTitle: "Gros contrats, nerfs en mousse",
        atmosphere:
          "Le trimestre tient sur quelques deals XXL. L'ambiance ressemble a une finale de poker ou tout le monde sourit avec des mains moyennes.",
        situation:
          `${teamName} a encore de belles opportunites, mais les clients demandent du sur-mesure, des remises et un peu la lune avec. Vous devez choisir entre arroser large pour provoquer des signatures rapides ou jouer sniper sur quelques dossiers vraiment gagnables.`,
        options: [
          {
            id: "A",
            title: "Jeter des remises comme des confettis",
            description:
              "Ouvrir une semaine de flex tarifaire musclée pour faire tomber vite les signatures qui trainent."
          },
          {
            id: "B",
            title: "Passer en mode sniper sur 5 deals",
            description:
              "Reduire le pipe, proteger la marge et concentrer tout le cerveau collectif sur les dossiers qui sentent vraiment la victoire."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les indices fiables montrent un pipe fatigue, pas un marche qui exige juste plus de discount. Le bon coup n'est pas de faire du bruit, c'est de viser juste.",
        decks: {
          true: [
            {
              headline: "Le pipe existe, mais il s'effiloche au mauvais endroit",
              body:
                "Le pipeline qualifié a reculé de 18% en deux semaines, surtout sur les opportunités les plus complexes. Les prospects encore vivants veulent une proposition plus simple, pas forcément moins chère.",
              sharePrompt: "Aide l'équipe à distinguer volume de pipe et qualité réelle du pipe.",
              adminTruth: "Données consolidées du pipe confirmées."
            },
            {
              headline: "La marge est déjà sous pression",
              body:
                "Trois gros dossiers concentrent une part majeure du trimestre, mais deux demandent des concessions tarifaires supérieures au cadre habituel. Si on généralise la remise, l'atterrissage de marge devient vite douloureux.",
              sharePrompt: "Partage le risque de dilution de marge.",
              adminTruth: "Exposition marge confirmée."
            },
            {
              headline: "Le blocage vient aussi du circuit interne",
              body:
                "Les validations avant-vente et pricing prennent jusqu'à six jours de trop sur les dossiers personnalisés. Plusieurs deals 'presque signés' sont surtout coincés chez nous.",
              sharePrompt: "Rappelle que tout n'est pas un problème client.",
              adminTruth: "Retards internes confirmés."
            },
            {
              headline: "Le terrain voit une fatigue commerciale réelle",
              body:
                "Deux commerciaux clés sont à saturation et traitent trop d'opportunités en parallèle. Tout le monde travaille, mais personne ne sait vraiment sur quels comptes il faut miser en premier.",
              sharePrompt: "Ramène le débat sur la focalisation des forces.",
              adminTruth: "Signal confirmé par la charge commerciale."
            },
            {
              headline: "Les comptes les plus mûrs réagissent bien au cadrage",
              body:
                "Quand l'offre est simplifiée et le sponsor identifié, le taux de transformation remonte vite. Le sujet n'est pas seulement de signer plus, mais de signer mieux.",
              sharePrompt: "Mets en avant le levier de simplification.",
              adminTruth: "Signal confirmé sur les dossiers les plus avancés."
            },
            {
              headline: "Le concurrent fait du bruit, pas forcément de la valeur",
              body:
                "Oui, un acteur du marché pousse des remises très visibles. Mais sur les dossiers où le besoin est bien qualifié, les clients arbitrent encore sur la solidité d'exécution.",
              sharePrompt: "Nuance la panique face au concurrent.",
              adminTruth: "Lecture de marché confirmée."
            }
          ],
          partial: [
            {
              headline: "Une région affirme qu'une promo relancerait tout en 48h",
              body:
                "Le retour est sincère, mais très local. Rien ne prouve encore que ce qui marche sur un périmètre restreint sauverait le pipe national.",
              sharePrompt: "Présente-le comme un angle terrain, pas comme une vérité globale.",
              adminTruth: "Hypothèse terrain non consolidée."
            },
            {
              headline: "Un compte stratégique serait prêt à signer vite",
              body:
                "Le commercial le pense franchement, mais le décisionnaire côté client n'a pas encore confirmé la trajectoire. On manque d'un vrai 'oui' en face.",
              sharePrompt: "Souligne la différence entre enthousiasme commercial et validation client.",
              adminTruth: "Signal plausible mais non sécurisé."
            },
            {
              headline: "Le pricing pourrait accélérer les validations",
              body:
                "Un manager annonce un renfort immédiat, sans planning ni ressources verrouillées. C'est possible, mais pas assez certain pour baser toute la décision dessus.",
              sharePrompt: "Garde cette info au rang de pari interne.",
              adminTruth: "Promesse non confirmée."
            },
            {
              headline: "La fatigue équipe serait surtout un ressenti",
              body:
                "Plusieurs personnes disent 'ça tient encore'. Peut-être, mais aucune mesure sérieuse ne prouve que la surcharge actuelle est soutenable jusqu'à la clôture.",
              sharePrompt: "Invite le groupe à ne pas sous-estimer les signaux humains.",
              adminTruth: "Signal incomplet, pas un contre-argument ferme."
            }
          ],
          false: [
            {
              headline: "Un concurrent aurait déjà signé une exclusivité décisive",
              body:
                "La rumeur circule parce qu'elle fait peur et qu'elle ressemble à un vrai coup de marché. Personne n'a pourtant obtenu de confirmation fiable ce matin.",
              sharePrompt: "Ne traite pas cette rumeur comme un fait.",
              adminTruth: "Rumeur fausse ou non confirmée."
            },
            {
              headline: "La direction aurait déjà accepté les remises hors cadre",
              body:
                "Le message a été répété plusieurs fois, donc il paraît solide. En réalité, aucune validation centrale n'a été émise.",
              sharePrompt: "Prudence: confort psychologique ne veut pas dire validation.",
              adminTruth: "Faux: aucune autorisation globale."
            },
            {
              headline: "Le pipe est faible uniquement à cause du prix",
              body:
                "Cette explication simple rassure tout le monde parce qu'elle donne un bouton facile à presser. Les faits montrent pourtant un problème plus large de ciblage et de cycle de vente.",
              sharePrompt: "Résiste à l'explication unique.",
              adminTruth: "Faux cadrage causal."
            }
          ]
        }
      };
    case "sales-retail":
      return {
        scenarioTitle: "Magasins pleins, paniers timides",
        atmosphere:
          "Visuellement, ca ressemble a une bonne journee. En vrai, c'est le genre de decor ou tout le monde s'agite et ou les tickets de caisse font semblant d'etre impressionnes.",
        situation:
          `${teamName} voit encore passer du monde, mais les magasins tournent de facon inegale, certains clients errent comme dans un escape game mal fleche, et les equipes commencent a avoir le regard vide. Vous devez choisir entre lancer une mega promo tape-a-l'oeil ou transformer pendant quelques jours les points de vente en commando anti-friction.`,
        options: [
          {
            id: "A",
            title: "Balancer une mega promo sirene",
            description:
              "Faire entrer encore plus de monde avec une offre impossible a rater, en esperant que l'energie revienne par magie."
          },
          {
            id: "B",
            title: "Monter un commando anti-friction",
            description:
              "Replacer les renforts, fluidifier le parcours et s'acharner sur les micro-cailloux qui sabotent la conversion."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables disent la meme chose: ce n'est pas une crise de trafic, c'est un festival de petites frictions. Ajouter de la foule avant de remettre de l'ordre reviendrait a lancer une fete dans une cuisine en feu.",
        decks: {
          true: [
            {
              headline: "Le trafic tient, la conversion non",
              body:
                "Les entrées magasin restent honorables, mais le taux de conversion baisse depuis trois semaines. Le problème n'est pas d'attirer plus de monde; c'est de réussir à transformer les visites utiles.",
              sharePrompt: "Recadre le débat sur la conversion plutôt que sur le simple trafic.",
              adminTruth: "Tendance confirmée sur les KPI vente."
            },
            {
              headline: "Les équipes de front sont sous pression",
              body:
                "Les pics d'activité sont mal absorbés sur certains créneaux et les managers passent leur temps à combler des trous. À force, le conseil client baisse de qualité.",
              sharePrompt: "Partage l'impact terrain sur l'expérience client.",
              adminTruth: "Charge opérationnelle confirmée."
            },
            {
              headline: "Les ruptures courtes coûtent plus que prévu",
              body:
                "Quelques références clés ne sont pas absentes longtemps, mais elles manquent exactement quand le trafic monte. C'est suffisant pour faire dérailler une partie des ventes faciles.",
              sharePrompt: "Souligne le coût des micro-ruptures.",
              adminTruth: "Signal confirmé par les relevés de disponibilité."
            },
            {
              headline: "La promo large masquerait le vrai sujet",
              body:
                "Elle ferait monter les flux, oui. Mais avec le niveau d'organisation actuel, une partie du trafic supplémentaire serait mal servi et ferait surtout grimper la fatigue équipe.",
              sharePrompt: "Aide à voir le risque d'un faux remède.",
              adminTruth: "Effet probable validé par les simulations internes."
            },
            {
              headline: "Certaines zones performent malgré la tension",
              body:
                "Là où le brief est clair, le stock maîtrisé et les renforts bien placés, la conversion tient mieux. Ça montre que l'exécution locale reste le principal levier court terme.",
              sharePrompt: "Amene des preuves qu'une meilleure manoeuvre locale paie.",
              adminTruth: "Comparaison de zones confirmée."
            },
            {
              headline: "Les clients demandent surtout plus de fluidité",
              body:
                "Les retours terrain remontent les mêmes irritants: attente, orientation confuse et promesses pas toujours tenues. Le frein à l'achat n'est pas seulement le prix.",
              sharePrompt: "Ramène la voix client dans la discussion.",
              adminTruth: "Signal client recoupé."
            }
          ],
          partial: [
            {
              headline: "Une opération locale aurait très bien marché samedi",
              body:
                "C'est encourageant, mais le retour vient d'un point de vente bien staffé et très particulier. Difficile d'en faire une preuve pour tout le réseau.",
              sharePrompt: "Présente-le comme un test intéressant, pas comme une généralité.",
              adminTruth: "Signal local partiel."
            },
            {
              headline: "Le marketing pense qu'une vague promo remobiliserait les équipes",
              body:
                "Peut-être psychologiquement, mais rien ne montre que cela résoudra les problèmes d'attente et de disponibilité terrain.",
              sharePrompt: "Fais la différence entre énergie perçue et efficacité réelle.",
              adminTruth: "Hypothèse non démontrée."
            },
            {
              headline: "Le stock serait suffisant 'presque partout'",
              body:
                "La formule rassure, mais elle ne répond pas aux ruptures sur les références qui comptent au moment clé. On manque d'une photographie précise.",
              sharePrompt: "Insiste sur la qualité du stock, pas seulement son volume total.",
              adminTruth: "Signal incomplet."
            },
            {
              headline: "Les clients seraient devenus ultra sensibles au prix",
              body:
                "C'est peut-être vrai sur certains segments, mais les derniers verbatims montrent aussi des irritants d'expérience très concrets. Le diagnostic reste mixte.",
              sharePrompt: "Nuance la lecture purement tarifaire.",
              adminTruth: "Tendance plausible mais non exclusive."
            }
          ],
          false: [
            {
              headline: "Un concurrent casserait déjà les prix sur tout le territoire",
              body:
                "L'info tourne vite parce qu'elle est parfaite pour justifier une riposte immédiate. Aucune veille consolidée ne confirme pourtant cette ampleur nationale.",
              sharePrompt: "Attention au réflexe panique.",
              adminTruth: "Rumeur non confirmée."
            },
            {
              headline: "Le réseau pourrait absorber 30% de trafic en plus sans effort",
              body:
                "Le chiffre a été repris plusieurs fois, sans source opérationnelle solide. Vu la tension équipe actuelle, il est très probablement fantaisiste.",
              sharePrompt: "Questionne la capacité réelle derrière l'affirmation.",
              adminTruth: "Faux: surestimation nette de capacité."
            },
            {
              headline: "Les clients n'ont plus aucun problème d'attente",
              body:
                "Ce récit contredit les remontées terrain et les verbatims les plus récents. Il est confortable, mais faux.",
              sharePrompt: "Résiste aux récits trop propres.",
              adminTruth: "Faux au vu des données client."
            }
          ]
        }
      };
    case "finance":
      return {
        scenarioTitle: "La caisse fait du parkour",
        atmosphere:
          "La tresorerie n'est pas morte, mais elle court sur les toits avec des chaussures lisses. Tout le monde explique que 'ca va passer', ce qui est rarement une methode de pilotage.",
        situation:
          `${teamName} voit des sorties d'argent se multiplier pendant que chacun defend son urgence preferee avec la conviction d'un acteur en audition. Vous devez choisir entre sortir le coupe-circuit cash ou tenter un numero d'equilibriste en laissant chaque direction s'auto-discipliner.`,
        options: [
          {
            id: "A",
            title: "Sortir le coupe-circuit cash",
            description:
              "Geler tout ce qui n'est pas vital, respirer, et regarder qui proteste vraiment pour de bonnes raisons."
          },
          {
            id: "B",
            title: "Faire confiance au self-control collectif",
            description:
              "Laisser chaque direction trier ses depenses tout en jurant tres fort qu'elle sera raisonnable."
          }
        ],
        correctDecision: "A",
        rationale:
          "Les indices fiables montrent un vrai glissement de cash et beaucoup trop de bonnes excuses. Dans cette mission, croire au self-control general revient a laisser un buffet ouvert a des gens affames.",
        decks: {
          true: [
            {
              headline: "Le décalage de trésorerie n'est plus théorique",
              body:
                "Deux encaissements attendus ont glissé et la fenêtre de respiration se raccourcit. Ce n'est pas dramatique aujourd'hui, mais ça peut le devenir très vite si personne ne freine les sorties.",
              sharePrompt: "Pose clairement le sujet cash, sans dramatiser inutilement.",
              adminTruth: "Tension cash confirmée."
            },
            {
              headline: "Certaines dépenses peuvent vraiment attendre",
              body:
                "Une partie des demandes du moment améliore le confort opérationnel, pas la survie business. Les traiter comme urgentes brouille l'arbitrage.",
              sharePrompt: "Aide l'équipe à distinguer critique et souhaitable.",
              adminTruth: "Analyse confirmée sur le portefeuille de dépenses."
            },
            {
              headline: "Le vrai risque est la dispersion des petites sorties",
              body:
                "Aucune ligne isolée n'a l'air folle. C'est l'accumulation mal pilotée qui crée le problème, avec des engagements pris un peu partout sans vue d'ensemble.",
              sharePrompt: "Insiste sur l'effet cumulatif.",
              adminTruth: "Signal confirmé par les engagements ouverts."
            },
            {
              headline: "Les projets critiques peuvent rester protégés",
              body:
                "Le gel ne veut pas dire couper l'oxygene partout. Quelques lignes vraiment sensibles ont ete identifiees et peuvent etre securisees dans le cadre de la manoeuvre cash.",
              sharePrompt: "Rassure sur la possibilité d'un gel intelligent.",
              adminTruth: "Périmètre critique déjà balisé."
            },
            {
              headline: "Le tempo de décision compte autant que le montant",
              body:
                "Chaque journée perdue laisse partir de nouveaux engagements difficiles à rattraper ensuite. Le sujet est autant un problème de vitesse de gouvernance que de finance pure.",
              sharePrompt: "Ramène l'urgence sur la gouvernance.",
              adminTruth: "Observation confirmée."
            },
            {
              headline: "Le discours 'on compensera plus tard' est fragile",
              body:
                "Plusieurs directions comptent sur des gains futurs ou des encaissements optimistes pour justifier les sorties d'aujourd'hui. Ce raisonnement n'est pas assez robuste pour piloter à court terme.",
              sharePrompt: "Challenge les paris de compensation future.",
              adminTruth: "Hypothèses trop optimistes confirmées."
            }
          ],
          partial: [
            {
              headline: "Un gros encaissement pourrait tomber en avance",
              body:
                "C'est possible, mais pas signé. S'appuyer dessus maintenant, c'est piloter la trésorerie avec un vœu pieux.",
              sharePrompt: "Traite cette info comme une option, pas comme un coussin garanti.",
              adminTruth: "Plausible, non confirmé."
            },
            {
              headline: "Les directions assurent qu'elles peuvent auto-discipliner leurs dépenses",
              body:
                "Certaines y arriveront, d'autres moins. Sans cadre central, ce type d'engagement reste très variable dans l'exécution.",
              sharePrompt: "Souligne le risque d'hétérogénéité.",
              adminTruth: "Promesse crédible mais insuffisante."
            },
            {
              headline: "Le gel risquerait de casser le moral",
              body:
                "Peut-être, mais ce coût humain reste à mettre en balance avec le coût d'un cash non maîtrisé. L'effet précis n'est pas mesuré.",
              sharePrompt: "Garde le point humain, sans lui donner plus de certitude qu'il n'en a.",
              adminTruth: "Impact possible mais non quantifié."
            },
            {
              headline: "Un fournisseur accepterait de décaler la facturation",
              body:
                "L'idée circule, sans accord écrit. Utile à explorer, trop faible pour fonder la décision.",
              sharePrompt: "À partager comme piste, pas comme solution.",
              adminTruth: "Promesse non sécurisée."
            }
          ],
          false: [
            {
              headline: "Le budget complémentaire serait déjà acté",
              body:
                "Cette rumeur soulage tout le monde, donc elle se diffuse vite. Elle ne repose pourtant sur aucune validation formelle.",
              sharePrompt: "Ne t'appuie pas dessus dans le débat.",
              adminTruth: "Faux: aucune validation."
            },
            {
              headline: "La tension cash disparaîtrait seule en fin de mois",
              body:
                "Le récit est pratique parce qu'il justifie l'attentisme. Les faits disponibles montrent au contraire un risque d'aggravation si rien n'est serré maintenant.",
              sharePrompt: "Méfie-toi des scénarios trop rassurants.",
              adminTruth: "Faux cadrage."
            },
            {
              headline: "Toutes les dépenses en cours sont vitales",
              body:
                "Affirmation classique en période tendue, mais fausse. Une partie relève clairement du confort ou du reportable.",
              sharePrompt: "Questionne le vocabulaire d'urgence absolue.",
              adminTruth: "Faux: portefeuille hétérogène."
            }
          ]
        }
      };
    case "marketing":
      return {
        scenarioTitle: "Feu d'artifice ou brouillard deluxe",
        atmosphere:
          "Tout le monde veut une campagne qui explose. Le probleme, c'est qu'un feu d'artifice mal cadre illumine surtout les erreurs.",
        situation:
          `${teamName} prepare une prise de parole visible, mais la promesse, le ciblage et la capacite a traiter derriere ne sont pas encore alignes. Vous devez choisir entre lancer le grand show tout de suite ou retarder legerement pour transformer le bruit en vrai impact.`,
        options: [
          {
            id: "A",
            title: "Lancer le grand show comme si tout etait pret",
            description:
              "Garder la date, faire du bruit, et esperer que le terrain suivra le tempo."
          },
          {
            id: "B",
            title: "Retarder pour regler la mire",
            description:
              "Recalibrer ciblage, promesse et relais terrain afin que les leads n'arrivent pas comme une pluie de problemes."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les indices fiables montrent un risque de beau bazar plutot que de belle performance. Le move gagnant est moins spectaculaire, mais beaucoup plus jouable.",
        decks: {
          true: [
            {
              headline: "Le volume de leads ne dit pas tout",
              body:
                "Les derniers dispositifs ont produit du volume, mais une part trop élevée a été jugée peu exploitable par les équipes aval. L'énergie est là; la qualité suit mal.",
              sharePrompt: "Replace la conversation sur la qualité de la demande.",
              adminTruth: "Écart volume/qualité confirmé."
            },
            {
              headline: "La promesse actuelle est trop large",
              body:
                "Le message attire, mais il ouvre des attentes que le terrain ne traite pas toujours de façon homogène. Résultat: beaucoup d'intérêt, pas assez de conversion propre.",
              sharePrompt: "Partage le risque de décalage entre promesse et exécution.",
              adminTruth: "Lecture confirmée par les équipes opérationnelles."
            },
            {
              headline: "Le timing interne reste fragile",
              body:
                "Le lancement peut se faire techniquement, mais la coordination avec les équipes de traitement n'est pas sécurisée partout. Une belle campagne sans relais solide peut vite se retourner contre vous.",
              sharePrompt: "Rappelle que visibilité sans capacité = dette à très court terme.",
              adminTruth: "Coordination partiellement insuffisante."
            },
            {
              headline: "Les segments performants sont identifiés",
              body:
                "Certaines cibles répondent bien quand le message est plus précis et moins grand public. Cela plaide pour un ajustement fin plutôt qu'un grand coup uniforme.",
              sharePrompt: "Amène l'idée d'un ciblage plus chirurgical.",
              adminTruth: "Segments performants confirmés."
            },
            {
              headline: "Le terrain préfère moins de leads, mieux cadrés",
              body:
                "Les équipes en aval disent clairement qu'elles gèrent mieux un flux plus propre qu'une vague large mal qualifiée. Le sujet n'est pas de remplir un tableau, mais de produire de la valeur.",
              sharePrompt: "Fais entendre la voix des utilisateurs internes.",
              adminTruth: "Retour terrain confirmé."
            },
            {
              headline: "Le calendrier reste encore récupérable",
              body:
                "Un décalage court ne casse pas la fenêtre business si le dispositif est mieux calé ensuite. La marge de manœuvre existe encore, mais pas longtemps.",
              sharePrompt: "Souligne qu'il y a encore le temps de corriger intelligemment.",
              adminTruth: "Fenêtre de tir confirmée."
            }
          ],
          partial: [
            {
              headline: "Un influenceur partenaire serait très disponible",
              body:
                "L'info est séduisante, mais aucun engagement ferme n'est signé. Ce n'est pas une base solide pour verrouiller la date.",
              sharePrompt: "Présente-le comme opportunité, pas comme acquis.",
              adminTruth: "Piste plausible, non confirmée."
            },
            {
              headline: "Le terrain dit pouvoir absorber le flux",
              body:
                "Certains managers le pensent, d'autres beaucoup moins. Le signal est trop hétérogène pour être traité comme une certitude.",
              sharePrompt: "Insiste sur l'hétérogénéité des retours.",
              adminTruth: "Signal mixte."
            },
            {
              headline: "Le décalage ferait perdre toute l'énergie du lancement",
              body:
                "C'est possible sur une partie de l'élan interne, mais rien ne prouve que l'impact serait aussi fort. Beaucoup dépend du récit donné au report.",
              sharePrompt: "Nuance la peur de perdre le momentum.",
              adminTruth: "Risque possible, non quantifié."
            },
            {
              headline: "Les audiences seraient déjà parfaitement prêtes",
              body:
                "Les premiers retours digitaux sont encourageants, mais trop courts pour garantir une performance durable. On a un indice, pas une certitude.",
              sharePrompt: "Garde de la prudence sur la maturité audience.",
              adminTruth: "Signal précoce seulement."
            }
          ],
          false: [
            {
              headline: "La concurrence lancerait une copie cette semaine",
              body:
                "L'argument pousse à agir vite, donc il circule bien. Il n'est pourtant confirmé par aucune veille solide.",
              sharePrompt: "Attention aux accélérateurs de panique.",
              adminTruth: "Rumeur non confirmée."
            },
            {
              headline: "Le budget média serait perdu si on décale",
              body:
                "C'est faux dans l'état actuel des engagements. Décaler coûte peut-être un peu d'énergie, pas l'intégralité du budget.",
              sharePrompt: "Questionne l'irréversibilité annoncée.",
              adminTruth: "Faux: budget encore reconfigurable."
            },
            {
              headline: "Tous les leads du dernier test étaient excellents",
              body:
                "Une lecture flatteuse, mais contraire aux retours de qualification. Le test a produit du bruit autant que des opportunités.",
              sharePrompt: "Résiste aux récits trop brillants.",
              adminTruth: "Faux au vu des taux de qualification."
            }
          ]
        }
      };
    case "customer-service":
      return {
        scenarioTitle: "Hotline en cocotte-minute",
        atmosphere:
          "Le plateau tient encore, mais on sent qu'un appel de plus un peu trop epice peut transformer la journee en Koh-Lanta sans riz ni totem.",
        situation:
          `${teamName} encaisse une hausse de contacts, des dossiers qui collent aux doigts et des clients qui ont deja entendu trois versions de la meme histoire. Vous devez choisir entre maintenir la petite musique commerciale comme si de rien n'etait ou mettre tout le monde en mode sauvetage express.`,
        options: [
          {
            id: "A",
            title: "Continuer l'upsell en serrant les dents",
            description:
              "Garder les objectifs commerciaux et demander un dernier effort heroique au plateau."
          },
          {
            id: "B",
            title: "Passer 72h en mode sauvetage express",
            description:
              "Mettre l'upsell au frigo, vider le backlog sensible et recoller une parole client propre."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables disent que la machine peut encore etre sauvee, mais pas si on lui demande de vendre pendant qu'elle recoud les degats.",
        decks: {
          true: [
            {
              headline: "Le backlog est devenu qualitatif, pas seulement quantitatif",
              body:
                "Ce ne sont pas juste plus de tickets. La part des dossiers sensibles et recontactés plusieurs fois augmente, ce qui abîme très vite la confiance client.",
              sharePrompt: "Insiste sur la nature du backlog, pas seulement son volume.",
              adminTruth: "Signal confirmé sur la typologie des dossiers."
            },
            {
              headline: "Les conseillers tiennent, mais en mode surchauffe",
              body:
                "Les équipes absorbent encore, mais avec davantage d'escalades, de reprises de dossiers et de fatigue visible. La marge de sécurité est mince.",
              sharePrompt: "Ramène le facteur humain dans l'équation.",
              adminTruth: "Fatigue opérationnelle confirmée."
            },
            {
              headline: "Les clients pardonnent un retard, moins les contradictions",
              body:
                "Le plus irritant remonte quand un client entend une chose puis son contraire selon le canal ou l'agent. La cohérence de réponse devient critique.",
              sharePrompt: "Souligne que la qualité de réponse compte autant que la vitesse.",
              adminTruth: "Verbatims clients confirmés."
            },
            {
              headline: "L'upsell dans ce contexte crée de la friction",
              body:
                "Quand un dossier n'est pas proprement résolu, la tentative commerciale sonne opportuniste. Elle peut faire gagner un peu à court terme mais détruire la relation.",
              sharePrompt: "Aide l'équipe à voir le mauvais timing commercial.",
              adminTruth: "Risque confirmé par les remontées qualité."
            },
            {
              headline: "Une remise à niveau rapide reste possible",
              body:
                "En recentrant trois jours les priorités et en clarifiant les scripts, le backlog sensible peut redescendre à un niveau plus sain. Le levier existe encore.",
              sharePrompt: "Rassure sur le fait qu'une action courte peut suffire.",
              adminTruth: "Capacité de rattrapage confirmée."
            },
            {
              headline: "Les canaux n'ont pas tous le même niveau de tension",
              body:
                "Le téléphone et certains points de contact souffrent plus que d'autres. Un arbitrage ciblé peut donc produire un vrai effet si on assume les priorités.",
              sharePrompt: "Pousse l'idée d'un recentrage ciblé, pas d'un arrêt total.",
              adminTruth: "Tension différenciée confirmée."
            }
          ],
          partial: [
            {
              headline: "Le pic serait peut-être déjà derrière nous",
              body:
                "Certains superviseurs le pensent, mais les séries restent trop courtes pour l'affirmer. Se rassurer trop tôt serait dangereux.",
              sharePrompt: "Présente ce point comme une hypothèse d'accalmie, pas une certitude.",
              adminTruth: "Plausible, non consolidé."
            },
            {
              headline: "Les clients accepteraient bien une relance commerciale",
              body:
                "C'est vrai sur une partie d'entre eux, surtout les cas simples. Le problème est que la situation actuelle n'est pas faite de cas simples.",
              sharePrompt: "Nuance le profil des clients concernés.",
              adminTruth: "Partiellement vrai selon les segments."
            },
            {
              headline: "Un renfort temporaire pourrait arriver très vite",
              body:
                "L'idée existe, mais l'effectif et la date ne sont pas verrouillés. Bon à avoir, trop flou pour servir de base de décision.",
              sharePrompt: "À partager comme possibilité, pas comme filet de sécurité.",
              adminTruth: "Promesse non confirmée."
            },
            {
              headline: "Le backlog n'aurait qu'un impact limité sur l'image",
              body:
                "Peut-être à très court terme, mais les verbatims les plus tendus montrent déjà des irritants répétés. Le risque réputationnel est difficile à mesurer précisément, pas inexistant.",
              sharePrompt: "Ne laisse pas le groupe minimiser trop vite l'effet image.",
              adminTruth: "Signal incertain mais sérieux."
            }
          ],
          false: [
            {
              headline: "La satisfaction client serait restée stable partout",
              body:
                "Le chiffre a été repris sans regarder les détails. Les poches de tension contredisent clairement cette lecture rassurante.",
              sharePrompt: "Questionne l'usage de moyennes trop lisses.",
              adminTruth: "Faux: stabilité globale trompeuse."
            },
            {
              headline: "Le backlog se résorberait seul d'ici demain",
              body:
                "Scénario confortable, mais contraire à la dynamique observée. Sans action ciblée, l'inertie joue contre vous.",
              sharePrompt: "Méfie-toi des prophéties auto-apaisantes.",
              adminTruth: "Faux au vu de la tendance."
            },
            {
              headline: "Les équipes peuvent absorber plus sans aucune baisse de qualité",
              body:
                "L'affirmation flatte la résilience des équipes, mais ne correspond pas aux reprises de dossiers déjà visibles.",
              sharePrompt: "Refuse le mythe du 'ça va passer'.",
              adminTruth: "Faux: qualité déjà impactée."
            }
          ]
        }
      };
    case "hr":
      return {
        scenarioTitle: "Managers en jonglage, equipes en surf",
        atmosphere:
          "Les indicateurs RH ne hurlent jamais. Ils font pire: ils sourient poliment pendant que tout le monde commence a fatiguer en silence.",
        situation:
          `${teamName} accompagne une transformation pendant que certaines equipes tirent sur la corde comme si c'etait un sport olympique. Vous devez choisir entre maintenir le tempo heroique du plan ou offrir une vraie respiration aux zones deja en surchauffe.`,
        options: [
          {
            id: "A",
            title: "Garder le turbo et compter sur le mental",
            description:
              "Tenir le calendrier, afficher de la determination et laisser le management absorber le choc."
          },
          {
            id: "B",
            title: "Donner de l'air avant la prochaine acceleration",
            description:
              "Proteger les equipes critiques, redistribuer la charge et relancer ensuite avec des gens encore vivants."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables montrent une fatigue reelle et un risque de casse silencieuse. Continuer au meme rythme serait confondre courage et entetement.",
        decks: {
          true: [
            {
              headline: "La fatigue n'est plus anecdotique",
              body:
                "Plusieurs équipes critiques cumulent charge élevée, absences courtes et signaux de lassitude. Ce n'est pas encore l'effondrement, mais clairement plus qu'un simple coup de mou.",
              sharePrompt: "Insiste sur la profondeur du signal humain.",
              adminTruth: "Fatigue confirmée."
            },
            {
              headline: "Le management intermédiaire absorbe trop",
              body:
                "Beaucoup de managers jouent à la fois le rôle de chef d'équipe, régulateur émotionnel et pompier opérationnel. À ce stade, leur bande passante devient le goulet d'étranglement.",
              sharePrompt: "Ramène la discussion sur les managers, pas seulement sur les effectifs.",
              adminTruth: "Surcharge managériale confirmée."
            },
            {
              headline: "Le turnover latent existe, même s'il ne se voit pas encore dans les sorties",
              body:
                "Les envies de départ se formulent plus clairement dans les échanges individuels. Attendre que cela se matérialise en démissions serait trop tardif.",
              sharePrompt: "Partage les signaux faibles avant qu'ils deviennent des signaux tardifs.",
              adminTruth: "Signal RH confirmé."
            },
            {
              headline: "Le plan peut respirer sans perdre tout son sens",
              body:
                "Une séquence de sécurisation humaine n'enterre pas la transformation. Elle peut au contraire éviter qu'elle soit rejetée comme une charge de plus.",
              sharePrompt: "Montre qu'un tempo ajusté n'est pas un abandon.",
              adminTruth: "Lecture confirmée côté conduite du changement."
            },
            {
              headline: "Les risques ne sont pas uniformes",
              body:
                "Certaines poches restent solides, d'autres sont déjà au bord de la saturation. Un traitement ciblé est possible si on assume les priorités.",
              sharePrompt: "Pousse l'idée d'un arbitrage fin plutôt qu'un grand message uniforme.",
              adminTruth: "Exposition différenciée confirmée."
            },
            {
              headline: "La charge invisible coûte cher",
              body:
                "Réunions supplémentaires, micro-conflits, temps passé à réexpliquer la trajectoire: cette charge ne sort pas toujours dans les tableaux, mais elle use fortement les équipes.",
              sharePrompt: "Aide le groupe à verbaliser le coût caché de la transformation.",
              adminTruth: "Signal corroboré par plusieurs remontées."
            }
          ],
          partial: [
            {
              headline: "Les équipes finiraient par s'habituer",
              body:
                "C'est un pari fréquent en transformation, mais il manque ici des éléments solides pour montrer un vrai palier d'adaptation.",
              sharePrompt: "Traite-le comme un pari culturel, pas comme une donnée.",
              adminTruth: "Hypothèse non démontrée."
            },
            {
              headline: "Un plan de reconnaissance rapide ferait redescendre la pression",
              body:
                "Peut-être en partie, mais rien ne prouve que cela suffise si la charge structurelle reste intacte.",
              sharePrompt: "Différencie soulagement symbolique et correction structurelle.",
              adminTruth: "Signal partiel."
            },
            {
              headline: "Le turnover serait surtout dû au marché externe",
              body:
                "Le marché joue sûrement un rôle, mais les retours internes montrent aussi des facteurs très domestiques. Le diagnostic n'est pas si simple.",
              sharePrompt: "Nuance l'explication par l'externe.",
              adminTruth: "Partiellement vrai seulement."
            },
            {
              headline: "Des renforts pourraient arriver vite",
              body:
                "La piste existe, sans calendrier fermement sécurisé. Utile à creuser, trop floue pour structurer la décision immédiate.",
              sharePrompt: "À partager comme option, pas comme certitude.",
              adminTruth: "Promesse non verrouillée."
            }
          ],
          false: [
            {
              headline: "Le climat social est totalement stable",
              body:
                "Lecture rassurante, mais contredite par les signaux faibles accumulés. Le calme apparent ne veut pas dire absence de tension.",
              sharePrompt: "Attention au faux calme.",
              adminTruth: "Faux au vu des remontées."
            },
            {
              headline: "Les managers ont encore beaucoup de bande passante",
              body:
                "Cette affirmation ne colle pas aux charges observées. Elle surestime nettement la capacité de portage actuelle.",
              sharePrompt: "Questionne toute hypothèse de confort managérial.",
              adminTruth: "Faux: saturation notable."
            },
            {
              headline: "Ralentir ferait automatiquement exploser le projet",
              body:
                "Le lien direct est exagéré. Un ajustement de rythme bien expliqué peut au contraire renforcer l'adhésion.",
              sharePrompt: "Résiste aux scénarios trop binaires.",
              adminTruth: "Faux cadrage."
            }
          ]
        }
      };
    case "governance":
      return {
        scenarioTitle: "Petites lignes, gros pieges",
        atmosphere:
          "Le dossier a l'air presque pret. C'est precisement dans les 'presque' que les ennuis aiment louer un appartement.",
        situation:
          `${teamName} tient un dossier contractuel qui donne tres envie d'etre signe vite pour passer a autre chose. Malheureusement, quelques angles morts juridiques et operationnels se cachent encore dans le decor. Vous devez choisir entre signer tout de suite ou appuyer sur pause 24h pour chasser les pieges.`,
        options: [
          {
            id: "A",
            title: "Signer avant que quelqu'un repose une question",
            description:
              "Boucler aujourd'hui, afficher que le sujet est derriere vous et corriger les details en marchant."
          },
          {
            id: "B",
            title: "Faire une chasse aux pieges de 24h",
            description:
              "Repasser clauses, dependances et delegations avec l'obstination d'une equipe qui ne veut pas lire 'on vous l'avait dit'."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables montrent surtout des angles morts qui ont le profil exact des ennuis chers et humiliants. Une journee de paranoïa utile vaut mieux qu'une signature trop contente d'elle.",
        decks: {
          true: [
            {
              headline: "Le texte tient globalement, mais pas partout",
              body:
                "Le socle du dossier est solide, pourtant quelques clauses sensibles restent encore interprétables. Ce sont précisément celles qui coûtent cher quand on les découvre trop tard.",
              sharePrompt: "Invite l'équipe à distinguer 'presque prêt' et 'sûr'.",
              adminTruth: "Zone de risque confirmée sur le contrat."
            },
            {
              headline: "Les dépendances opérationnelles ne sont pas toutes verrouillées",
              body:
                "Certaines équipes amont et aval se pensent alignées, mais les responsabilités concrètes restent floues sur quelques points. C'est typiquement le genre de flou qui explose après signature.",
              sharePrompt: "Ramène la décision sur la chaîne complète, pas le seul document.",
              adminTruth: "Dépendances confirmées."
            },
            {
              headline: "Le délai est tendu, pas désespéré",
              body:
                "On peut encore prendre une courte respiration sans perdre l'objectif. En revanche, si on signe mal, le rattrapage coûtera bien plus d'énergie.",
              sharePrompt: "Rappelle qu'un petit délai peut éviter une grosse dette.",
              adminTruth: "Fenêtre de revalidation confirmée."
            },
            {
              headline: "Le risque vient surtout des responsabilités mal nommées",
              body:
                "Plusieurs acteurs pensent être couverts alors que personne n'a vraiment la main sur l'exécution de bout en bout. C'est un risque classique et très réel.",
              sharePrompt: "Pousse l'équipe à parler de ownership.",
              adminTruth: "Ambiguïté de délégation confirmée."
            },
            {
              headline: "Un accord vite signé ferait illusion de maîtrise",
              body:
                "Le sentiment de 'c'est fait' serait confortable, mais pas forcément mérité. Or un faux sentiment de sécurité est particulièrement dangereux dans ce type de dossier.",
              sharePrompt: "Challenge l'illusion de clôture.",
              adminTruth: "Risque de maîtrise trompeuse confirmé."
            },
            {
              headline: "Le sujet est plus transversal qu'il n'en a l'air",
              body:
                "Ce qui semble administratif touche en realite l'operationnel, la reputation et l'orchestration du terrain. Le traiter comme une formalite serait une erreur.",
              sharePrompt: "Élargis le cadre du débat.",
              adminTruth: "Impact transversal confirmé."
            }
          ],
          partial: [
            {
              headline: "Le partenaire accepterait sans doute une correction plus tard",
              body:
                "Peut-être, mais rien n'est écrit et la relation de force n'est pas aussi confortable qu'on le raconte.",
              sharePrompt: "Présente-le comme une supposition fragile.",
              adminTruth: "Hypothèse non sécurisée."
            },
            {
              headline: "L'équipe aurait déjà tout relu deux fois",
              body:
                "C'est probablement vrai pour une partie, mais pas pour l'ensemble des angles. Le sentiment de revue complète n'est pas une preuve de couverture totale.",
              sharePrompt: "Nuance le confort de 'on a déjà regardé'.",
              adminTruth: "Signal partiel."
            },
            {
              headline: "Bloquer 24h serait mal perçu en interne",
              body:
                "Possible, mais l'impact précis dépendra beaucoup de la façon dont la décision est expliquée. Ce n'est pas un coût automatique.",
              sharePrompt: "Distingue perception initiale et bénéfice réel.",
              adminTruth: "Risque social possible, non quantifié."
            },
            {
              headline: "Le calendrier externe serait totalement rigide",
              body:
                "C'est ce qu'on entend, sans preuve que 24h changent vraiment la donne. L'urgence existe peut-être, son absolu reste à prouver.",
              sharePrompt: "Questionne le mot 'impossible'.",
              adminTruth: "Rigidité pas formellement prouvée."
            }
          ],
          false: [
            {
              headline: "Tout a déjà été validé juridiquement",
              body:
                "La phrase rassure, donc elle circule bien. Elle ne correspond pas à l'état réel du dossier.",
              sharePrompt: "Ne la prends pas pour un tampon officiel.",
              adminTruth: "Faux: validations incomplètes."
            },
            {
              headline: "Signer aujourd'hui supprimerait tout risque",
              body:
                "Au contraire: cela déplacerait le risque dans l'exécution. L'idée d'une disparition magique du risque est fausse.",
              sharePrompt: "Résiste au fantasme du dossier soldé.",
              adminTruth: "Faux cadrage."
            },
            {
              headline: "Un jour de plus ferait forcément perdre l'opportunité",
              body:
                "Scénario dramatique, mais non étayé. Il sert surtout à pousser à la signature rapide.",
              sharePrompt: "Mets la pression de côté et demande les preuves.",
              adminTruth: "Faux ou très exagéré."
            }
          ]
        }
      };
    case "network":
      return {
        scenarioTitle: "Week-end calme ou Wi-Fi roulette",
        atmosphere:
          "Le reseau n'est pas encore en crise. Il a juste ce petit regard insolent qui dit: 'vas-y, parie sur moi au pire moment'.",
        situation:
          `${teamName} repere une fragilite technique juste avant une periode de trafic sensible. Vous devez choisir entre ouvrir tout de suite la boite a outils pour corriger proprement ou prier tres professionnellement en renforcant seulement la surveillance.`,
        options: [
          {
            id: "A",
            title: "Ouvrir la boite a outils ce soir",
            description:
              "Prendre une fenetre de maintenance, assumer un inconfort court et eviter le drama pendant le pic."
          },
          {
            id: "B",
            title: "Croiser les doigts en HD",
            description:
              "Poser des rustines, monitorer comme des faucons et repousser la vraie intervention a plus tard."
          }
        ],
        correctDecision: "A",
        rationale:
          "Les signaux fiables montrent que le risque n'est pas imaginaire et que le pire moment pour apprendre est justement le pic de charge. Le move fun n'est pas le plus safe.",
        decks: {
          true: [
            {
              headline: "L'anomalie revient de plus en plus vite",
              body:
                "Les incidents restent localisés, mais leur fréquence se resserre. C'est le type de signal qui bascule vite d'agaçant à dangereux si on attend trop.",
              sharePrompt: "Partage l'idée d'une dérive accélérée, pas d'un simple bruit technique.",
              adminTruth: "Tendance incident confirmée."
            },
            {
              headline: "La fenêtre à venir augmente le risque",
              body:
                "Le trafic prévu ce week-end laisse moins de marge aux petits bricolages. Une faiblesse gérable en temps calme peut devenir beaucoup plus coûteuse en pointe.",
              sharePrompt: "Aide l'équipe à intégrer le facteur timing.",
              adminTruth: "Fenêtre sensible confirmée."
            },
            {
              headline: "Le contournement existe, mais reste fragile",
              body:
                "Oui, on peut tenir temporairement. Non, ce n'est pas une solution confortable si la charge monte vraiment ou si un second incident survient.",
              sharePrompt: "Nuance la tentation du patch temporaire.",
              adminTruth: "Contournement possible mais fragile."
            },
            {
              headline: "L'équipe connaît bien la correction",
              body:
                "L'intervention n'est pas une aventure improvisée: elle est maîtrisée, même si elle comporte un coût court terme. C'est important pour comparer les risques honnêtement.",
              sharePrompt: "Rassure sur la capacité d'exécution de l'équipe technique.",
              adminTruth: "Correction maîtrisée confirmée."
            },
            {
              headline: "Attendre transfère le risque au moment le plus visible",
              body:
                "Reporter donne une impression de confort immédiat, mais le coût d'un incident en pic serait bien plus brutal en image et en exploitation.",
              sharePrompt: "Ramène le débat sur le coût du mauvais moment.",
              adminTruth: "Risque de report confirmé."
            },
            {
              headline: "Le problème est encore sous contrôle... pour l'instant",
              body:
                "C'est précisément ce qui rend la décision difficile. On peut agir dans de bonnes conditions aujourd'hui, ou subir plus tard dans de moins bonnes.",
              sharePrompt: "Exprime clairement le dilemme contrôle vs attentisme.",
              adminTruth: "Lecture confirmée."
            }
          ],
          partial: [
            {
              headline: "La supervision pourrait suffire tout le week-end",
              body:
                "Peut-être si rien d'autre ne bouge. Or le problème est justement que plusieurs facteurs peuvent se cumuler.",
              sharePrompt: "Présente-le comme scénario optimiste, pas comme plan robuste.",
              adminTruth: "Hypothèse possible, non garantie."
            },
            {
              headline: "Le trafic annoncé pourrait être moins fort que prévu",
              body:
                "C'est plausible, mais les prévisions restent suffisamment élevées pour que le risque demeure sérieux.",
              sharePrompt: "Ne laisse pas l'optimisme trafic faire oublier le risque technique.",
              adminTruth: "Signal incomplet."
            },
            {
              headline: "Une autre équipe pourrait prendre le relais si besoin",
              body:
                "Sur le papier oui, mais les disponibilités exactes ne sont pas sécurisées. Ce renfort ne peut pas être traité comme acquis.",
              sharePrompt: "À partager comme secours potentiel seulement.",
              adminTruth: "Promesse non verrouillée."
            },
            {
              headline: "Les clients remarqueraient à peine une dégradation",
              body:
                "Certains segments peut-être, pas tous. L'impact réel dépend trop du moment et du périmètre pour être minimisé aussi vite.",
              sharePrompt: "Challenge les hypothèses de faible visibilité.",
              adminTruth: "Risque client incertain, pas faible par principe."
            }
          ],
          false: [
            {
              headline: "Le correctif serait plus risqué que l'incident lui-même",
              body:
                "L'affirmation dramatise l'intervention sans s'appuyer sur les retours techniques disponibles. Elle ne reflète pas la réalité du risque comparé.",
              sharePrompt: "Demande les preuves derrière la dramatisation.",
              adminTruth: "Faux cadrage."
            },
            {
              headline: "Le réseau est totalement stable hors bruit mineur",
              body:
                "Ce récit est trop optimiste et contredit la tendance de fréquence observée. Ce n'est pas juste du bruit.",
              sharePrompt: "Refuse la minimisation excessive.",
              adminTruth: "Faux: dérive réelle."
            },
            {
              headline: "Le week-end ne présente aucun enjeu particulier",
              body:
                "C'est faux au regard des prévisions de charge et des usages attendus. Le timing compte justement beaucoup.",
              sharePrompt: "Replace le contexte de charge au centre.",
              adminTruth: "Faux contexte."
            }
          ]
        }
      };
    case "it":
      return {
        scenarioTitle: "Patch pansement ou vraie chirurgie",
        atmosphere:
          "Le systeme tient avec la dignite d'une chaise montee un vendredi soir: assis, oui; rassurant, pas tellement.",
        situation:
          `${teamName} doit arbitrer entre sauver rapidement la face avec un patch express ou geler un peu la release pour nettoyer un flux devenu suspect. Vous devez choisir entre la victoire cosmetique et la stabilite qui prend deux jours mais evite les sequelles.`,
        options: [
          {
            id: "A",
            title: "Mettre un pansement premium",
            description:
              "Corriger vite, tenir la date et esperer que le monstre restera endormi assez longtemps."
          },
          {
            id: "B",
            title: "Faire la vraie chirurgie",
            description:
              "Geler 48h, nettoyer les dependances et relancer sur une base qui ne couine pas des demain matin."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables montrent que le bug visible n'est que la partie sympa du probleme. Le patch rapide a trop de chances de revenir avec des amis.",
        decks: {
          true: [
            {
              headline: "L'anomalie visible n'est que la partie émergée",
              body:
                "Le bug du moment se voit, mais il vient d'un flux déjà fragilisé par plusieurs exceptions et correctifs successifs. Réparer juste la surface est tentant, pas très durable.",
              sharePrompt: "Explique que le problème dépasse le symptôme.",
              adminTruth: "Lecture technique confirmée."
            },
            {
              headline: "Le calendrier annoncé pousse à la mauvaise tentation",
              body:
                "Tenir la date ferait plaisir à court terme, mais avec une probabilité élevée de rework ou d'incident de retour. Le coût caché serait probablement supérieur au retard assumé.",
              sharePrompt: "Mets en balance date tenue et dette supplémentaire.",
              adminTruth: "Risque de rework confirmé."
            },
            {
              headline: "Les équipes savent où agir",
              body:
                "Le travail de diagnostic a avancé. Ce n'est pas l'incertitude technique qui bloque, c'est la décision d'assumer ou non une courte respiration pour faire propre.",
              sharePrompt: "Rassure sur la capacité de correction structurée.",
              adminTruth: "Capacité de correction confirmée."
            },
            {
              headline: "La dette technique a déjà commencé à coûter en coordination",
              body:
                "Les mêmes personnes reviennent sans cesse sur les mêmes zones, avec de plus en plus d'allers-retours. C'est un coût de vitesse autant qu'un coût de qualité.",
              sharePrompt: "Ramène le sujet sur la dette opérationnelle réelle.",
              adminTruth: "Charge de coordination confirmée."
            },
            {
              headline: "Le patch court ne supprimera pas la fragilité du flux",
              body:
                "Il peut faire disparaître le symptôme du jour, pas stabiliser l'enchaînement complet. Le prochain incident serait alors vécu comme une surprise... alors qu'il était annoncé.",
              sharePrompt: "Aide le groupe à voir le risque de rechute.",
              adminTruth: "Risque de récidive confirmé."
            },
            {
              headline: "La confiance métier souffre surtout des retours arrière",
              body:
                "Un petit retard assumé se gère souvent mieux qu'une release maintenue puis partiellement cassée. La crédibilité se joue aussi dans la stabilité.",
              sharePrompt: "Pèse la confiance métier dans l'arbitrage.",
              adminTruth: "Retour d'expérience confirmé."
            }
          ],
          partial: [
            {
              headline: "Le patch pourrait suffire si tout se passe bien",
              body:
                "Oui, si aucune dépendance ne réagit mal et si le périmètre réel est bien celui qu'on croit. Ça fait beaucoup de 'si'.",
              sharePrompt: "Présente-le comme scénario optimiste, pas comme plan robuste.",
              adminTruth: "Possible mais fragile."
            },
            {
              headline: "Le métier accepterait facilement 48h de gel",
              body:
                "Certains interlocuteurs oui, d'autres non. L'acceptation existe peut-être, mais elle n'est pas uniforme.",
              sharePrompt: "Nuance la lecture de l'acceptabilité.",
              adminTruth: "Signal mixte."
            },
            {
              headline: "L'incident visible vient peut-être d'un cas rare",
              body:
                "C'est plausible, mais les éléments de dette autour du flux empêchent de l'écarter sérieusement à ce stade.",
              sharePrompt: "Mets de la prudence sur la thèse du cas isolé.",
              adminTruth: "Hypothèse non exclue, pas prouvée."
            },
            {
              headline: "Une autre équipe pourrait absorber le rework plus tard",
              body:
                "Peut-être, mais les capacités ne sont pas sécurisées. Ce filet de sécurité est trop théorique pour piloter dessus.",
              sharePrompt: "À partager comme secours potentiel uniquement.",
              adminTruth: "Promesse non confirmée."
            }
          ],
          false: [
            {
              headline: "Le flux est sain, seul un écran est concerné",
              body:
                "Cette lecture est séduisante parce qu'elle réduit le problème. Les faits techniques disponibles montrent une fragilité plus profonde.",
              sharePrompt: "Résiste à la simplification excessive.",
              adminTruth: "Faux diagnostic."
            },
            {
              headline: "La release maintenue ne présente aucun risque client",
              body:
                "C'est faux. Le risque n'est pas certain, mais il est suffisamment plausible pour peser dans la décision.",
              sharePrompt: "Demande une appréciation honnête du risque, pas une négation.",
              adminTruth: "Faux: risque client réel."
            },
            {
              headline: "Reporter 48h détruirait toute crédibilité",
              body:
                "Le lien est exagéré. Une courte pause expliquée vaut souvent mieux qu'une instabilité visible en production.",
              sharePrompt: "Nuance l'impact réputationnel du report.",
              adminTruth: "Faux cadrage."
            }
          ]
        }
      };
    case "fintech":
      return {
        scenarioTitle: "Croissance euphorique, fraude en embuscade",
        atmosphere:
          "Les volumes donnent envie d'appuyer plus fort. Les signaux fraude, eux, regardent la scene comme des figurants qui attendent leur moment pour voler le film.",
        situation:
          `${teamName} voit les usages grimper, mais plusieurs operations atypiques remontent avec une regularite pas tres rassurante. Vous devez choisir entre mettre quelques barrages tout de suite ou laisser l'autoroute ouverte et rattraper les curieux apres coup.`,
        options: [
          {
            id: "A",
            title: "Installer des barrages malins maintenant",
            description:
              "Ajouter des controles cibles, ralentir les flux les plus louches et proteger la confiance avant le show."
          },
          {
            id: "B",
            title: "Laisser l'autoroute ouverte et courir apres",
            description:
              "Garder un parcours ultra fluide et traiter les anomalies une fois qu'elles ont deja pris un peu d'avance."
          }
        ],
        correctDecision: "A",
        rationale:
          "Les signaux fiables montrent que la fraude est encore assez discrete pour etre contenue sans casser tout le jeu. Attendre reviendrait a laisser la porte ouverte par politesse.",
        decks: {
          true: [
            {
              headline: "Les signaux fraude montent vraiment",
              body:
                "Les cas restent minoritaires, mais leur fréquence et leur profil deviennent trop cohérents pour être traités comme du simple bruit. On est encore dans la zone où agir coûte moins cher que réparer.",
              sharePrompt: "Partage le signal tôt, avant l'incident visible.",
              adminTruth: "Hausse fraude confirmée."
            },
            {
              headline: "La croissance actuelle peut masquer le problème",
              body:
                "Quand les volumes montent, les anomalies se diluent facilement dans la masse. C'est confortable pour les KPI, moins pour la maîtrise du risque.",
              sharePrompt: "Aide le groupe à voir au-delà du volume.",
              adminTruth: "Lecture risque confirmée."
            },
            {
              headline: "Des contrôles ciblés existent déjà",
              body:
                "Le sujet n'est pas d'inventer une usine à gaz. Quelques verrous supplémentaires sur les flux à risque suffiraient à réduire sensiblement l'exposition.",
              sharePrompt: "Rassure sur le caractère ciblé de la friction.",
              adminTruth: "Levier technique confirmé."
            },
            {
              headline: "La confiance se perd plus vite qu'elle ne se regagne",
              body:
                "Un incident fraude visible peut coûter plus en image et en adoption future qu'une petite friction bien expliquée aujourd'hui.",
              sharePrompt: "Pèse la confiance long terme face au confort immédiat.",
              adminTruth: "Risque réputationnel confirmé."
            },
            {
              headline: "Tous les utilisateurs ne seront pas impactés",
              body:
                "Les profils les plus sains resteront largement fluides si les contrôles sont bien calibrés. L'arbitrage n'est pas entre bloquer tout le monde ou ne rien faire.",
              sharePrompt: "Nuance la peur d'un parcours cassé pour tous.",
              adminTruth: "Impact ciblé confirmé."
            },
            {
              headline: "Le temps joue contre vous",
              body:
                "Plus on laisse les schémas douteux s'installer, plus ils se normalisent dans les volumes. Le coût de correction augmente alors très vite.",
              sharePrompt: "Ramène l'urgence sur le facteur temps.",
              adminTruth: "Effet d'inertie confirmé."
            }
          ],
          partial: [
            {
              headline: "La hausse des anomalies viendrait peut-être d'un faux positif",
              body:
                "C'est possible sur une partie des alertes, mais pas suffisamment probable pour évacuer le sujet.",
              sharePrompt: "Présente-le comme une nuance, pas comme une annulation du risque.",
              adminTruth: "Hypothèse possible, insuffisante."
            },
            {
              headline: "Les utilisateurs accepteraient facilement plus de vérifications",
              body:
                "Peut-être certains, pas tous. La tolérance à la friction dépend du contexte et du calibrage exact.",
              sharePrompt: "Reste prudent sur l'acceptation client.",
              adminTruth: "Signal partiel."
            },
            {
              headline: "Un partenaire technique promet une amélioration rapide",
              body:
                "Bonne piste, mais pas encore livrée. Impossible d'en faire un filet de sécurité ferme aujourd'hui.",
              sharePrompt: "À partager comme perspective, pas comme bouclier.",
              adminTruth: "Promesse non confirmée."
            },
            {
              headline: "La surveillance manuelle suffirait peut-être",
              body:
                "À petite dose, peut-être. Dès que le volume grimpe, cette option perd vite en robustesse.",
              sharePrompt: "Nuance la confiance dans le manuel.",
              adminTruth: "Plausible à petite échelle seulement."
            }
          ],
          false: [
            {
              headline: "Il n'y a aucun vrai risque, seulement plus d'usage",
              body:
                "Cette lecture rassure mais ne colle pas au profil des alertes remontées. Le signal n'est pas qu'un effet volume.",
              sharePrompt: "Attention à la minimisation confortable.",
              adminTruth: "Faux diagnostic."
            },
            {
              headline: "Durcir les contrôles ferait fuir la majorité des utilisateurs",
              body:
                "Le scénario est exagéré et présenté sans base solide. L'impact dépend fortement du ciblage des contrôles.",
              sharePrompt: "Demande des preuves avant d'acheter cette peur.",
              adminTruth: "Faux cadrage."
            },
            {
              headline: "Les anomalies observées ont déjà toutes été traitées",
              body:
                "C'est faux: plusieurs cas restent encore en cours d'analyse ou d'arbitrage.",
              sharePrompt: "Refuse toute illusion de problème clos.",
              adminTruth: "Faux au vu du backlog d'analyse."
            }
          ]
        }
      };
    case "external":
      return {
        scenarioTitle: "Photo officielle ou coulisses en vrac",
        atmosphere:
          "Le partenariat ferait une tres belle photo. La question est surtout de savoir si quelqu'un saura expliquer ensuite pourquoi les coulisses ressemblent encore a un chantier.",
        situation:
          `${teamName} prepare une annonce brillante autour d'un partenariat ou d'un engagement visible, mais plusieurs relais internes bricolent encore le mode d'emploi. Vous devez choisir entre sortir les projecteurs tout de suite ou peaufiner les coulisses avant la photo.`,
        options: [
          {
            id: "A",
            title: "Allumer les projecteurs cette semaine",
            description:
              "Prendre la parole vite, profiter de l'effet waouh et finir les details pendant que la musique tourne."
          },
          {
            id: "B",
            title: "Repeindre les coulisses avant la photo",
            description:
                "Verifier preuves, relais et execution pour eviter qu'une belle annonce sente le decor en carton."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables montrent qu'une annonce brillante mais bancale ferait rire jaune tres vite. Le bon coup, ici, c'est de retarder le selfie pour eviter le flop.",
        decks: {
          true: [
            {
              headline: "L'opportunité est bonne, la préparation moins",
              body:
                "Le partenariat ou le projet a du sens, mais plusieurs relais internes ne sont pas encore prêts à le porter concrètement. Une parole forte sans exécution crédible serait risquée.",
              sharePrompt: "Mets la cohérence d'exécution au cœur du débat.",
              adminTruth: "Alignement interne incomplet confirmé."
            },
            {
              headline: "Les preuves disponibles sont encore inégales",
              body:
                "Certaines actions sont solides, d'autres relèvent encore d'intentions ou de plans. Pour une prise de parole crédible, cette différence compte énormément.",
              sharePrompt: "Aide l'équipe à distinguer preuve et intention.",
              adminTruth: "Écart preuve/intention confirmé."
            },
            {
              headline: "Le risque d'effet vitrine existe",
              body:
                "Si la communication part trop vite, l'interne peut la vivre comme du vernis. Et l'externe peut vite poser des questions très concrètes ensuite.",
              sharePrompt: "Amène le groupe sur le risque de promesse trop brillante.",
              adminTruth: "Risque réputationnel confirmé."
            },
            {
              headline: "Le calendrier reste encore maniable",
              body:
                "Décaler un peu ne ferme pas la fenêtre d'opportunité. Cela permet surtout de renforcer la crédibilité du message.",
              sharePrompt: "Rappelle que patience ne veut pas dire renoncement.",
              adminTruth: "Fenêtre encore ouverte."
            },
            {
              headline: "Les parties prenantes internes n'ont pas toutes la même lecture",
              body:
                "Certaines y voient un levier fort, d'autres un sujet encore brouillon. Cette divergence est déjà un signal utile avant d'aller dehors.",
              sharePrompt: "Partage le manque d'alignement interne.",
              adminTruth: "Divergence confirmée."
            },
            {
              headline: "Une annonce solide peut devenir un vrai actif",
              body:
                "À l'inverse, si les preuves et relais sont bien préparés, la prise de parole aura davantage d'impact et beaucoup moins d'angles morts.",
              sharePrompt: "Montre que le report peut créer de la valeur, pas juste du délai.",
              adminTruth: "Levier confirmé."
            }
          ],
          partial: [
            {
              headline: "L'externe attendrait une réponse très rapide",
              body:
                "Peut-être, mais rien ne dit qu'un léger décalage serait rédhibitoire. Le niveau d'urgence exact est encore flou.",
              sharePrompt: "Questionne la pression de calendrier sans la nier.",
              adminTruth: "Urgence plausible, pas formalisée."
            },
            {
              headline: "Les équipes internes se mobiliseraient plus après annonce",
              body:
                "Cela peut arriver, mais ce n'est pas un substitut à la préparation. Une mobilisation forcée par la communication peut aussi crisper.",
              sharePrompt: "Distingue effet d'entraînement et effet de contrainte.",
              adminTruth: "Hypothèse non démontrée."
            },
            {
              headline: "Le projet serait déjà compris partout",
              body:
                "C'est probablement vrai dans les cercles proches du dossier, beaucoup moins au-delà. L'appropriation reste inégale.",
              sharePrompt: "Nuance le sentiment d'évidence interne.",
              adminTruth: "Signal partiel."
            },
            {
              headline: "Le report serait mal interprété à l'externe",
              body:
                "Possible, mais très dépendant de la manière de gérer la relation et le récit. Rien ne permet d'en faire une certitude.",
              sharePrompt: "Présente cela comme un risque relationnel, pas comme une fatalité.",
              adminTruth: "Risque possible, non sûr."
            }
          ],
          false: [
            {
              headline: "Tout est prêt, il manque juste la date",
              body:
                "C'est précisément le genre de phrase qu'on prononce quand on veut aller vite. Elle ne colle pas à l'état réel du dossier.",
              sharePrompt: "Questionne toute affirmation de préparation totale.",
              adminTruth: "Faux: plusieurs points restent ouverts."
            },
            {
              headline: "Une annonce rapide réglerait les hésitations internes",
              body:
                "C'est séduisant, mais faux. Communiquer trop tôt déplacerait le problème au lieu de le résoudre.",
              sharePrompt: "Refuse la magie supposée de l'annonce.",
              adminTruth: "Faux cadrage."
            },
            {
              headline: "L'externe a déjà validé sans réserve tous les détails",
              body:
                "Aucune validation aussi large n'existe. L'information est exagérée.",
              sharePrompt: "Demande des preuves concrètes avant d'y croire.",
              adminTruth: "Faux."
            }
          ]
        }
      };
    case "strategy":
      return {
        scenarioTitle: "Plan wahou, mode d'emploi introuvable",
        atmosphere:
          "Le plan est magnifique en slide. On sent en revanche que, sur le terrain, quelqu'un va bientot demander ou se cache le bouton 'comprendre ce qu'on fait lundi matin'.",
        situation:
          `${teamName} porte un plan ambitieux qui promet beaucoup, mais l'appropriation du terrain reste inegale et parfois franchement creative. Vous devez choisir entre lancer tout le circus maintenant ou faire un pilote sur deux zones avant la grande tournee.`,
        options: [
          {
            id: "A",
            title: "Lancer la grande tournee tout de suite",
            description:
              "Deployer partout, montrer de l'ambition et prier pour que l'execution rattrape la presentation."
          },
          {
            id: "B",
            title: "Faire un pilote avant la tournee mondiale",
            description:
              "Tester sur deux entites, corriger les flous et arriver ensuite avec des preuves au lieu d'un poster."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables montrent un plan prometteur mais pas encore digere partout. Le pilote n'est pas un frein: c'est le moment ou on remplace les grands discours par de vraies preuves.",
        decks: {
          true: [
            {
              headline: "Le cap stratégique est compréhensible, pas l'exécution concrète",
              body:
                "Les grandes lignes du plan sont acceptées. Ce qui varie énormément, c'est la compréhension du 'qui fait quoi quand' sur le terrain.",
              sharePrompt: "Ramène le débat sur l'exécution, pas sur la vision.",
              adminTruth: "Écart vision/exécution confirmé."
            },
            {
              headline: "Les gains sont crédibles, pas encore pilotables partout",
              body:
                "Oui, des bénéfices existent. Mais ils ne reposent pas encore partout sur des mécanismes suffisamment précis pour être suivis sereinement.",
              sharePrompt: "Nuance la promesse de gains avec la maturite d'execution.",
              adminTruth: "Potentiel confirmé, maturité partielle."
            },
            {
              headline: "Certaines entités sont prêtes à servir de pilote",
              body:
                "Deux périmètres ressortent comme plus alignés, plus outillés et plus aptes à produire un vrai retour d'expérience. C'est une opportunité à saisir.",
              sharePrompt: "Pousse l'idée du pilote utile, pas du pilote dilatoire.",
              adminTruth: "Périmètres pilotes identifiés."
            },
            {
              headline: "Le risque principal est de vendre une évidence qui n'en est pas une",
              body:
                "Ce qui paraît limpide en comité ne l'est pas toujours en exécution. Un déploiement trop large révélerait les zones de flou à grande échelle.",
              sharePrompt: "Partage le risque de faux consensus.",
              adminTruth: "Risque confirmé."
            },
            {
              headline: "Le pilote peut accélérer la suite au lieu de la freiner",
              body:
                "S'il est bien conçu, il produit des preuves, des cas d'usage et un langage commun. Cela vaut souvent plus qu'un grand lancement mal digéré.",
              sharePrompt: "Montre que le pilote peut être une rampe, pas un frein.",
              adminTruth: "Valeur d'apprentissage confirmée."
            },
            {
              headline: "La ligne de transformation a besoin de crédibilité terrain",
              body:
                "À ce stade, le meilleur carburant du plan n'est pas une nouvelle slide, mais des preuves que ça marche chez des opérationnels réels.",
              sharePrompt: "Ramène le débat sur la crédibilité opérationnelle.",
              adminTruth: "Besoin de preuves terrain confirmé."
            }
          ],
          partial: [
            {
              headline: "L'ensemble des équipes serait déjà aligné",
              body:
                "C'est vrai dans le discours de certains sponsors, beaucoup moins dans l'appropriation concrète observée sur le terrain.",
              sharePrompt: "Nuance le sentiment d'alignement global.",
              adminTruth: "Signal partiel."
            },
            {
              headline: "Un lancement large créerait un choc positif salutaire",
              body:
                "Possible dans certaines cultures, mais rien ne garantit qu'il surmontera les zones de flou déjà identifiées.",
              sharePrompt: "Présente-le comme un pari culturel, pas comme une certitude.",
              adminTruth: "Hypothèse non démontrée."
            },
            {
              headline: "Le pilote ferait perdre trop de temps",
              body:
                "Cela dépend du design du pilote. Mal conçu, oui; bien conçu, pas forcément.",
              sharePrompt: "Questionne le procès fait au pilote en lui-même.",
              adminTruth: "Risque possible, pas automatique."
            },
            {
              headline: "Les résistances seraient marginales",
              body:
                "Certaines remontées le suggèrent, mais d'autres montrent des incompréhensions bien plus fortes. Le tableau reste hétérogène.",
              sharePrompt: "Aide le groupe à éviter la sous-estimation des résistances.",
              adminTruth: "Signal mixte."
            }
          ],
          false: [
            {
              headline: "Le plan est prêt à l'échelle sans aucun angle mort",
              body:
                "C'est faux: plusieurs dépendances d'exécution ne sont pas stabilisées.",
              sharePrompt: "Refuse les récits de maturité totale.",
              adminTruth: "Faux."
            },
            {
              headline: "Un pilote enverrait forcément un signal de faiblesse",
              body:
                "Le lien est trop simpliste. Un pilote bien assumé peut au contraire signaler une exigence d'exécution élevée.",
              sharePrompt: "Résiste au faux dilemme ambition vs prudence.",
              adminTruth: "Faux cadrage."
            },
            {
              headline: "Les gains tomberaient automatiquement dès le lancement large",
              body:
                "C'est précisément ce qui n'est pas démontré. Les gains dépendent de la qualité d'appropriation.",
              sharePrompt: "Ne confonds pas annonce et résultat.",
              adminTruth: "Faux."
            }
          ]
        }
      };
    case "operations":
      return {
        scenarioTitle: "Tout le monde parle, qui priorise ?",
        atmosphere:
          "Les chiffres ne hurlent pas, les gens si, un peu. On est dans ce moment delicieux ou tout le monde a une bonne idee et aucune envie d'abandonner la sienne.",
        situation:
          `${teamName} recoit des signaux utiles, contradictoires et parfois tres joliment racontes. Vous devez choisir entre un grand geste visible qui donne l'impression de reprendre la main et une frappe plus fine sur les zones qui menacent vraiment de partir en vrille.`,
        options: [
          {
            id: "A",
            title: "Faire le grand geste qui rassure",
            description:
              "Lancer une reponse large, visible et facile a raconter, meme si elle dilue un peu les moyens."
          },
          {
            id: "B",
            title: "Frapper fin sur les vrais points chauds",
            description:
              "Concentrer l'action la ou ca chauffe vraiment et accepter que le plan soit moins sexy mais plus efficace."
          }
        ],
        correctDecision: "B",
        rationale:
          "Les signaux fiables convergent sur quelques poches de risque bien reelles. Le move intelligent n'est pas celui qui fait le plus de bruit, c'est celui qui touche juste.",
        decks: {
          true: [
            {
              headline: "Le risque n'est pas uniforme",
              body:
                "Quelques zones ressortent nettement plus tendues que les autres. C'est là que l'action a le meilleur rendement court terme.",
              sharePrompt: "Mets en avant l'hétérogénéité du risque.",
              adminTruth: "Signal confirmé."
            },
            {
              headline: "La dispersion coûte déjà en efficacité",
              body:
                "Les équipes traitent trop de sujets en parallèle. Le vrai levier est de resserrer l'attention sur ce qui peut vraiment dérailler.",
              sharePrompt: "Ramène le groupe sur la priorisation.",
              adminTruth: "Observation confirmée."
            },
            {
              headline: "Une réponse trop large diluerait les moyens",
              body:
                "Elle donnerait un sentiment d'action, mais pas forcément d'impact là où c'est critique.",
              sharePrompt: "Challenge l'action visible mais peu ciblée.",
              adminTruth: "Risque confirmé."
            },
            {
              headline: "Le court terme reste maîtrisable",
              body:
                "À condition de traiter vite les vrais points chauds. L'inaction ou la dilution seraient plus dangereuses.",
              sharePrompt: "Souligne qu'il existe encore une fenêtre d'action.",
              adminTruth: "Fenêtre confirmée."
            },
            {
              headline: "Les équipes savent où appuyer",
              body:
                "Le problème n'est pas le manque d'idées, mais le choix clair des priorités.",
              sharePrompt: "Pousse l'idée d'un cap court et net.",
              adminTruth: "Capacité d'action confirmée."
            },
            {
              headline: "Les signaux les plus fiables convergent",
              body:
                "Même s'ils sont partiels, ils racontent tous à peu près la même tension de fond. C'est suffisant pour agir intelligemment.",
              sharePrompt: "Aide le groupe à distinguer convergence et bruit.",
              adminTruth: "Convergence confirmée."
            }
          ],
          partial: [
            {
              headline: "Une action large rassurerait tout le monde",
              body:
                "Peut-être politiquement, pas forcément opérationnellement. L'effet précis reste incertain.",
              sharePrompt: "Présente-le comme bénéfice perçu, pas démontré.",
              adminTruth: "Signal partiel."
            },
            {
              headline: "Les zones non critiques pourraient se dégrader vite aussi",
              body:
                "C'est possible, mais rien ne montre qu'elles soient au même niveau d'urgence que les points déjà identifiés.",
              sharePrompt: "Nuance le réflexe d'élargissement.",
              adminTruth: "Hypothèse possible."
            },
            {
              headline: "Le terrain demande une réponse spectaculaire",
              body:
                "Certains la demandent, d'autres surtout de la clarté. Le besoin exact est encore mélangé.",
              sharePrompt: "Partage ce signal sans le surinterpréter.",
              adminTruth: "Signal mixte."
            },
            {
              headline: "Un renfort global pourrait arriver",
              body:
                "Piste utile, mais non sécurisée à temps.",
              sharePrompt: "Garde-le au rang de bonus potentiel.",
              adminTruth: "Promesse non confirmée."
            }
          ],
          false: [
            {
              headline: "Tout est sous contrôle partout",
              body:
                "C'est faux au regard des points chauds déjà identifiés.",
              sharePrompt: "Résiste à la minimisation globale.",
              adminTruth: "Faux."
            },
            {
              headline: "Une réponse visible suffit toujours",
              body:
                "Elle peut rassurer sans résoudre. Le lien automatique est faux.",
              sharePrompt: "Questionne le théâtre de l'action.",
              adminTruth: "Faux cadrage."
            },
            {
              headline: "Le groupe n'a pas besoin de prioriser",
              body:
                "C'est précisément l'inverse: tout l'enjeu est dans la priorisation.",
              sharePrompt: "Rappelle que décider, c'est choisir.",
              adminTruth: "Faux."
            }
          ]
        }
      };
  }
}

function buildCards(team: TeamGame, stableSeed: string): GeneratedCard[] {
  const rng = createRng(`${team.id}-${stableSeed}`);
  const distribution = getTruthDistribution(team.participants.length);
  const blueprint = buildScenarioForTeam(team.name, team.archetype as Archetype, `${team.id}-${stableSeed}`);

  const deckByTruth: Record<CardTruth, CardTemplate[]> = {
    true: shuffleArray(
      withFallbacks(blueprint.decks.true, distribution.true, trueVariants),
      rng
    ),
    partial: shuffleArray(
      withFallbacks(blueprint.decks.partial, distribution.partial, partialVariants),
      rng
    ),
    false: shuffleArray(
      withFallbacks(blueprint.decks.false, distribution.false, falseVariants),
      rng
    )
  };

  const combined = shuffleArray(
    (["true", "partial", "false"] as CardTruth[]).flatMap((truthType) =>
      deckByTruth[truthType].slice(0, distribution[truthType]).map((template) => ({
        ...template,
        truthType
      }))
    ),
    rng
  );

  return team.participants.map((participant, index) => {
    const template = combined[index];
    return {
      id: `${participant.id}-${hashString(`${stableSeed}-${template.headline}`)}`,
      participantId: participant.id,
      participantName: participant.name,
      teamId: team.id,
      truthType: template.truthType,
      headline: template.headline,
      body: template.body,
      sharePrompt: template.sharePrompt,
      adminTruth: template.adminTruth,
      isIntruder: false,
      sabotageChoice: null,
      sabotageBrief: null
    };
  });
}

function resolveRoleLabel(participant: Participant): string {
  return participant.service || participant.direction || participant.teamName || "Direction non precisee";
}

const MAX_PARTICIPANTS_PER_TEAM = 11;

function buildTargetTeamSizes(participantCount: number): number[] {
  if (participantCount <= 0) {
    return [];
  }

  const teamCount = Math.max(1, Math.ceil(participantCount / MAX_PARTICIPANTS_PER_TEAM));
  const baseSize = Math.floor(participantCount / teamCount);
  const extraSeats = participantCount % teamCount;

  return Array.from({ length: teamCount }, (_, index) => baseSize + (index < extraSeats ? 1 : 0));
}

function buildMixSummary(roleCounts: Map<string, number>): string {
  return Array.from(roleCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([label, count]) => `${label} x${count}`)
    .join(" • ");
}

function extractTeamNumber(value: string): number {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function buildScenarioForTeam(
  contextLabel: string,
  archetype: Archetype,
  seed: string
): ScenarioBlueprint {
  const base = buildScenarioBlueprint(contextLabel, archetype);
  const overlay = buildFictionOverlay(archetype);
  const topLayer: ScenarioBlueprint = {
    ...base,
    scenarioTitle: overlay.scenarioTitle,
    atmosphere: overlay.atmosphere,
    situation: overlay.situation,
    options: overlay.options,
    rationale: overlay.rationale
  };
  const fictionDecks = buildFictionDecks(archetype, topLayer.options, topLayer.correctDecision);
  const tone = getFictionCardTone(archetype);
  const rng = createRng(`tone-${seed}-${contextLabel}`);
  const titlePrefix = pickFromPool(
    missionCodeNames[archetype] ?? missionCodeNames.operations,
    rng
  );
  const atmosphereHook = pickFromPool(
    atmosphereHooksByArchetype[archetype] ?? [
      "Le plus joli plan du moment est rarement celui qui vous aime vraiment.",
      "Le decor essaye fort de vous rassurer. C'est deja une raison suffisante pour lever un sourcil."
    ],
    rng
  );
  const situationHook = pickFromPool(
    situationHooksByArchetype[archetype] ?? [
      "Le vrai mini-jeu consiste a separer ce qui sonne merveilleusement de ce qui tient vraiment debout.",
      "Vous avez assez d'elements pour choisir, jamais assez pour vous pavaner."
    ],
    rng
  );
  const rationaleHook = pickFromPool(
    rationaleHooksByArchetype[archetype] ?? [
      "Le meilleur move n'est pas le plus spectaculaire, c'est celui qui garde encore son sens cinq minutes apres le panache.",
      "La bonne reponse recompense surtout les equipes qui resistent aux raccourcis joliment emballes."
    ],
    rng
  );
  const optionFlavors =
    optionFlavorByArchetype[archetype] ?? {
      A: ["Mode gros bouton rouge", "Plan coup de frein", "Option pare-chocs"],
      B: ["Mode commando malin", "Plan infiltration", "Option corde raide"]
    };

  const decorateDeck = (deck: CardTemplate[]) =>
    deck.map((template) => {
      const shareLead = pickFromPool(tone.shareLeads, rng);
      const shareCloser = pickFromPool(tone.shareClosers, rng);
      const bodyHook = pickFromPool(tone.bodyHooks, rng);
      const headlineLead = pickFromPool(tone.headlineLeads, rng);
      const headlineSting = pickFromPool(tone.headlineStings, rng);
      const bodyLead = pickFromPool(tone.bodyLeads, rng);
      const fictionalHeadline = fictionalizeCardCopy(template.headline, archetype);
      const fictionalBody = fictionalizeCardCopy(template.body, archetype);
      const fictionalSharePrompt = fictionalizeCardCopy(template.sharePrompt, archetype);
      return {
        ...template,
        headline: `${headlineLead} ${fictionalHeadline} • ${headlineSting}`,
        body: `${bodyLead} ${fictionalBody} ${bodyHook}`,
        sharePrompt: `${shareLead} ${fictionalSharePrompt} ${shareCloser}`
      };
    });

  const decoratedOptions = topLayer.options.map((option) => {
    const flavor = pickFromPool(optionFlavors[option.id], rng);
    return {
      ...option,
      title: `${flavor}: ${option.title}`
    };
  }) as [TeamGame["options"][0], TeamGame["options"][1]];

  return {
    ...base,
    scenarioTitle: `${titlePrefix} • ${topLayer.scenarioTitle}`,
    atmosphere: `${topLayer.atmosphere} ${atmosphereHook}`,
    situation: `${topLayer.situation} ${situationHook}`,
    options: decoratedOptions,
    rationale: `${topLayer.rationale} ${rationaleHook}`,
    decks: {
      true: decorateDeck(fictionDecks.true),
      partial: decorateDeck(fictionDecks.partial),
      false: decorateDeck(fictionDecks.false)
    }
  };
}

function assignBalancedTeams(
  participants: Participant[],
  stableSeed: string
): Array<{
  id: string;
  name: string;
  leadRole: string;
  mixSummary: string;
  participants: Participant[];
}> {
  const targetTeamSizes = buildTargetTeamSizes(participants.length);
  const roleBuckets = new Map<string, Participant[]>();

  participants.forEach((participant) => {
    const role = resolveRoleLabel(participant);
    const bucket = roleBuckets.get(role) ?? [];
    bucket.push(participant);
    roleBuckets.set(role, bucket);
  });

  const slots = targetTeamSizes.map((targetSize, index) => ({
    id: `equipe-${index + 1}`,
    name: `Equipe ${index + 1}`,
    targetSize,
    participants: [] as Participant[],
    roleCounts: new Map<string, number>()
  }));

  const orderedRoles = Array.from(roleBuckets.entries()).sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }
    return left[0].localeCompare(right[0]);
  });

  orderedRoles.forEach(([role, bucketParticipants], roleIndex) => {
    const bucketSeed = createRng(`${stableSeed}-${role}-${roleIndex}`);
    const shuffledBucket = shuffleArray(bucketParticipants, bucketSeed);

    shuffledBucket.forEach((participant) => {
      const target = slots
        .map((slot, index) => ({
          slot,
          index,
          roleCount: slot.roleCounts.get(role) ?? 0,
          total: slot.participants.length,
          targetSize: slot.targetSize,
          fillRatio: slot.participants.length / slot.targetSize
        }))
        .filter(({ total, targetSize }) => total < targetSize)
        .sort((left, right) => {
          if (left.roleCount !== right.roleCount) {
            return left.roleCount - right.roleCount;
          }
          if (left.fillRatio !== right.fillRatio) {
            return left.fillRatio - right.fillRatio;
          }
          if (left.total !== right.total) {
            return left.total - right.total;
          }
          return left.index - right.index;
        })[0];

      const assignedParticipant: Participant = {
        ...participant,
        teamId: target.slot.id,
        teamName: target.slot.name
      };

      target.slot.participants.push(assignedParticipant);
      target.slot.roleCounts.set(role, (target.slot.roleCounts.get(role) ?? 0) + 1);
    });
  });

  return slots
    .map((slot) => {
      const sortedRoleEntries = Array.from(slot.roleCounts.entries()).sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      });

      return {
        id: slot.id,
        name: slot.name,
        leadRole: sortedRoleEntries[0]?.[0] ?? "Cellule mixte",
        mixSummary: buildMixSummary(slot.roleCounts),
        participants: [...slot.participants].sort((left, right) => left.name.localeCompare(right.name))
      };
    })
    .sort((left, right) => extractTeamNumber(left.name) - extractTeamNumber(right.name));
}

export function generateGame(participants: Participant[], sourceName: string): GameSnapshot {
  const generatedAt = new Date().toISOString();
  const stableSeed = hashString(
    `${sourceName}-${participants
      .map((participant) => `${participant.id}:${resolveRoleLabel(participant)}`)
      .join("|")}`
  );
  const balancedTeams = assignBalancedTeams(participants, stableSeed);

  const teams = balancedTeams
    .map((balancedTeam, index) => {
      const archetype = UNIQUE_TEAM_ARCHETYPES[index % UNIQUE_TEAM_ARCHETYPES.length];
      const scenario = buildScenarioForTeam(
        balancedTeam.name,
        archetype,
        `${balancedTeam.id}-${stableSeed}`
      );
      const team: TeamGame = {
        id: balancedTeam.id,
        name: balancedTeam.name,
        direction: "Cellule tactique",
        leadRole: balancedTeam.leadRole,
        mixSummary: balancedTeam.mixSummary,
        participants: balancedTeam.participants,
        archetype,
        scenarioTitle: scenario.scenarioTitle,
        atmosphere: scenario.atmosphere,
        situation: scenario.situation,
        options: scenario.options,
        correctDecision: scenario.correctDecision,
        sabotageDecision: oppositeDecision(scenario.correctDecision),
        rationale: scenario.rationale,
        cards: [],
        intruderIds: [],
        truthCounts: getTruthDistribution(balancedTeam.participants.length)
      };
      team.cards = buildCards(team, stableSeed);
      return assignIntrudersToTeam(team, stableSeed);
    })
    .sort((left, right) => extractTeamNumber(left.name) - extractTeamNumber(right.name));

  const assignedParticipants = teams.flatMap((team) => team.participants);

  return {
    contentVersion: GAME_CONTENT_VERSION,
    sourceName,
    generatedAt,
    participants: assignedParticipants,
    teams
  };
}

export function buildCardIndex(snapshot: GameSnapshot): Record<string, { team: TeamGame; card: GeneratedCard }> {
  return snapshot.teams.reduce<Record<string, { team: TeamGame; card: GeneratedCard }>>((accumulator, team) => {
    team.cards.forEach((card) => {
      accumulator[card.id] = { team, card };
    });
    return accumulator;
  }, {});
}
