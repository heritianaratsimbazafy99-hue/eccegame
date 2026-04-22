import type { DecisionOption, DecisionOptionId, GeneratedCard, TeamGame } from "../types";
import { hashString } from "./utils";
import { toReadableFrench } from "./readableFrench";

interface DisplayTeamCopy {
  scenarioTitle: string;
  atmosphere: string;
  situation: string;
  options: [DecisionOption, DecisionOption];
  rationale: string;
  correctDecision: DecisionOptionId;
  sabotageDecision: DecisionOptionId;
  intruderIds: string[];
}

interface DisplayCardCopy {
  headline: string;
  body: string;
  sharePrompt: string;
  sabotageBrief: string | null;
  adminTruth: string;
  isIntruder: boolean;
  sabotageChoice: DecisionOptionId | null;
}

interface BaseDisplayTeamCopy {
  scenarioTitle: string;
  atmosphere: string;
  situation: string;
  options: [DecisionOption, DecisionOption];
  rationale: string;
  correctDecision: DecisionOptionId;
}

interface CardDisplayTemplate {
  headline: string;
  body: string;
  sharePrompt: string;
  adminTruth: string;
}

const TEAM_COPY_BY_SCENARIO: Record<string, BaseDisplayTeamCopy> = {
  "Bal des Doubles": {
    scenarioTitle: "Le Grand Escape Game du Centre Commercial",
    atmosphere:
      "Centre commercial fermé, portes roulantes à moitié baissées, talkies qui grésillent et chrono géant au mur. C'est un jeu, donc tout le monde ment avec le sourire.",
    situation:
      "Une clé dorée doit être récupérée avant le reset final des salles. Deux plans sont possibles : déclencher une fausse évacuation pour faire sortir tout le monde, ou laisser le jeu continuer et surveiller seulement les trois salles finalistes.",
    options: [
      {
        id: "A",
        title: "Déclencher la fausse évacuation",
        description: "Faire sonner l'alarme test pour vider les salles et observer ce que chacun protège."
      },
      {
        id: "B",
        title: "Suivre les 3 salles finalistes",
        description:
          "Laisser le jeu continuer et surveiller seulement les trois équipes qui sont allées le plus loin."
      }
    ],
    rationale:
      "Le bon choix était la fausse évacuation. Les trois salles finalistes faisaient surtout diversion, alors que l'alarme ouvrait le vrai couloir utile.",
    correctDecision: "A"
  },
  "Train Minuit": {
    scenarioTitle: "Le Laser Game avant Blackout",
    atmosphere:
      "Salle d'arcade, fumée au sol, lumière violette et arbitres qui courent dans tous les sens. C'est bruyant, fun et parfait pour rater un détail utile.",
    situation:
      "Un mot secret doit être lancé dans l'arène 7 juste avant le round blackout. Deux plans sont possibles : couper toute l'arène maintenant, ou laisser la partie commencer et tenir la station de recharge où tous les joueurs finissent par repasser.",
    options: [
      {
        id: "A",
        title: "Couper toute l'arène",
        description: "Arrêter la partie avant le blackout pour contrôler tous les joueurs d'un coup."
      },
      {
        id: "B",
        title: "Tenir la station de recharge",
        description:
          "Laisser le round démarrer et attendre les suspects au point où leurs équipements devront revenir."
      }
    ],
    rationale:
      "Le bon choix était de tenir la station de recharge. Couper toute l'arène semblait rassurant, mais cela effaçait surtout les trajectoires utiles.",
    correctDecision: "B"
  },
  "Musée des Ombres": {
    scenarioTitle: "La Battle de Cuisine en Direct",
    atmosphere:
      "Plateau TV, casseroles qui claquent, chronos partout et chefs qui jouent leur vie sur une sauce. C'est drôle à regarder et très mauvais pour réfléchir calmement.",
    situation:
      "Une épice rare doit changer de cuisine avant la dégustation finale. Deux plans sont possibles : lancer un contrôle surprise des ingrédients pour forcer toutes les brigades à montrer leurs réserves, ou laisser le tournage continuer et surveiller seulement le monte-plats.",
    options: [
      {
        id: "A",
        title: "Lancer le contrôle surprise",
        description:
          "Interrompre l'émission avec un contrôle immédiat des ingrédients dans toutes les cuisines."
      },
      {
        id: "B",
        title: "Surveiller le monte-plats",
        description:
          "Laisser le tournage continuer et attendre l'échange près du monte-plats entre cuisines."
      }
    ],
    rationale:
      "Le bon choix était le contrôle surprise. Le monte-plats avait l'air logique, mais il servait surtout à attirer l'attention loin du vrai moment d'échange.",
    correctDecision: "A"
  },
  "Port des Brumes": {
    scenarioTitle: "La Fête Foraine sous Orage",
    atmosphere:
      "Peluches géantes, sol mouillé, lumières qui clignotent et musique bancale. C'est absurde, coloré et beaucoup plus piégeux que ça en a l'air.",
    situation:
      "Un coffre est caché parmi les gros lots avant la fermeture du parc. Deux plans sont possibles : allumer toutes les lumières pour fouiller chaque stand, ou laisser la fête comme elle est et surveiller la grande pince, seul vrai outil capable de bouger le coffre.",
    options: [
      {
        id: "A",
        title: "Allumer toute la fête",
        description: "Mettre tous les stands en plein phare et contrôler chaque stand un par un."
      },
      {
        id: "B",
        title: "Camper la grande pince",
        description:
          "Laisser la fête tourner encore un peu et attendre le coffre au seul endroit où il devra passer."
      }
    ],
    rationale:
      "Le bon choix était de tenir la grande pince. Allumer tout le parc semblait puissant, mais cela rendait surtout l'équipe impossible à cacher.",
    correctDecision: "B"
  }
};

const CARD_COPY_BY_HEADLINE: Record<string, CardDisplayTemplate> = {
  "Trois masques, pas cinquante": {
    headline: "L'alarme ouvre le bon couloir",
    body:
      "Le plan sécurité montre qu'une seule chose ouvre le couloir du coffre : l'alarme évacuation. Sans elle, les finalistes tournent surtout en rond dans leurs salles.",
    sharePrompt: "Rappelle que le vrai accès ne s'ouvre pas tout seul.",
    adminTruth: "Vrai : l'alarme ouvre bien le couloir utile."
  },
  "La musique est le couvercle": {
    headline: "Les salles finalistes font surtout du bruit",
    body:
      "Les trois salles finalistes sont celles qui attirent les caméras et le public. Elles sont visibles, très occupées, et parfaites pour détourner l'attention.",
    sharePrompt: "Glisse que 'voir beaucoup' ne veut pas dire 'voir juste'.",
    adminTruth: "Vrai : les salles finalistes servent surtout de diversion."
  },
  "Un valet a vu passer la même enveloppe": {
    headline: "Le même trousseau repasse chez le staff bleu",
    body:
      "Une hôtesse a vu le même trousseau magnétique passer deux fois près du staff bleu, jamais près des équipes finalistes.",
    sharePrompt: "Rappelle que l'objet tourne déjà dans un petit cercle.",
    adminTruth: "Vrai : le trousseau observé oriente vers le staff, pas vers les finalistes."
  },
  "L'escalier discret reste ouvert": {
    headline: "La sortie réserve mène au coffre",
    body:
      "La petite sortie réserve derrière la boutique cadeaux rejoint directement le couloir du coffre dès que l'alarme test se déclenche.",
    sharePrompt: "Dis qu'une sortie discrète vaut mieux qu'un couloir plein de monde.",
    adminTruth: "Vrai : la sortie réserve est bien le passage utile."
  },
  "Le barman adore les coupures de musique": {
    headline: "Le présentateur jure que les gagnants iront au podium",
    body:
      "Le présentateur assure que les équipes finalistes iront forcément toutes au podium avec leurs sacs. C'est plausible, mais pas garanti.",
    sharePrompt: "Présente cela comme une piste crédible, pas comme une certitude.",
    adminTruth: "Partiel : possible, mais pas assez solide pour décider seul."
  },
  "Invitations jumelles": {
    headline: "Deux bracelets visiteurs se ressemblent trop",
    body:
      "Deux bracelets visiteurs semblent clonés. Cela suggère de fausses identités dans le centre, sans dire où ira la clé.",
    sharePrompt: "Utilise-le pour nourrir le doute, pas pour conclure trop vite.",
    adminTruth: "Partiel : c'est un signal utile mais incomplet."
  },
  "Le chef sécurité promet un gel parfait": {
    headline: "La sécurité promet une évacuation ultra propre",
    body:
      "Le chef sécurité affirme pouvoir faire sortir tout le monde en douceur, sans agitation ni cachette de dernière minute. C'est beaucoup trop beau.",
    sharePrompt: "Questionne toute promesse de chaos zéro.",
    adminTruth: "Faux : une évacuation parfaite est irréaliste."
  },
  "La liste des invités suffit": {
    headline: "Le tableau des scores suffirait à trouver les voleurs",
    body:
      "Un animateur pense qu'en regardant le classement des salles, on saura automatiquement qui tient la clé. C'est surtout pratique pour se rassurer.",
    sharePrompt: "Fais sentir qu'un classement n'explique pas un échange caché.",
    adminTruth: "Faux : le classement ne permet pas d'identifier le bon groupe."
  },
  "Le message ne sera dit qu'une fois": {
    headline: "Tous les blasters passent par la recharge",
    body:
      "Le plan de l'arène montre que les blasters doivent repasser par la station de recharge avant le blackout complet.",
    sharePrompt: "Rappelle que le bon point de passage vaut parfois plus qu'une coupure totale.",
    adminTruth: "Vrai : la recharge est bien un passage obligé."
  },
  "Le faux contrôleur manque une pièce": {
    headline: "Couper toute l'arène efface les bonnes traces",
    body:
      "Si toute l'arène coupe d'un coup, les scores se figent, les joueurs sortent de partout et les trajectoires deviennent illisibles.",
    sharePrompt: "Dis qu'arrêter trop tôt fait parfois perdre la seule trace utile.",
    adminTruth: "Vrai : la coupure totale détruit une partie de la lecture."
  },
  "Le frein d'urgence du wagon 7 est bloqué": {
    headline: "Le même bracelet UV revient à la recharge",
    body:
      "Une hôtesse a vu le même bracelet UV revenir deux fois près de la station de recharge, jamais près de la sortie générale.",
    sharePrompt: "Glisse que quelque chose revient toujours au même endroit.",
    adminTruth: "Vrai : ce signal renforce la piste de la recharge."
  },
  "Le colis ne saute pas d'un train lancé": {
    headline: "La porte technique derrière la recharge ferme mal",
    body:
      "La petite porte de maintenance derrière la recharge ferme mal. C'est discret et utile pour une interception ciblée.",
    sharePrompt: "Rappelle qu'un point discret peut valoir plus qu'un grand arrêt.",
    adminTruth: "Vrai : cette porte crée une bonne fenêtre d'interception."
  },
  "Le vendeur de thé adore les rumeurs": {
    headline: "Le vendeur de sodas dit que les top teams se regroupent au centre",
    body:
      "Le vendeur de sodas jure que les meilleurs joueurs reviennent toujours à la tour centrale avant la fin. C'est possible, pas certain.",
    sharePrompt: "Présente-le comme un indice, pas comme une preuve.",
    adminTruth: "Partiel : ça peut aider, sans suffire."
  },
  "Une fenêtre ferme mal": {
    headline: "Deux pseudos joueurs semblent clonés",
    body:
      "Deux pseudos de joueurs apparaissent avec des variantes presque identiques. Ça parle de déguisement, pas forcément du bon lieu d'échange.",
    sharePrompt: "Utilise-le pour créer du doute, pas pour trancher seul.",
    adminTruth: "Partiel : signe de fausse piste possible, mais incomplet."
  },
  "Le faux badge est déjà prêt": {
    headline: "Le technicien promet que la coupure gardera toutes les caméras actives",
    body:
      "Un technicien affirme qu'en coupant toute l'arène, les caméras resteront nettes et les portes bien verrouillées. Rien ne le prouve.",
    sharePrompt: "Questionne ce plan miracle avant d'y croire.",
    adminTruth: "Faux : la promesse technique n'est pas fiable."
  },
  "Les suspects n'agissent que si le train s'arrête": {
    headline: "Le tableau des scores dirait déjà qui porte le mot secret",
    body:
      "Quelqu'un affirme que le meilleur score final montrera forcément qui a transmis le mot secret. Cela ne tient pas.",
    sharePrompt: "Rappelle qu'un score n'est pas une preuve d'échange.",
    adminTruth: "Faux : le score ne permet pas de conclure."
  },
  "La copie ne passe pas par l'escalier": {
    headline: "Le contrôle surprise sort toutes les boîtes d'épices",
    body:
      "Le règlement du plateau impose qu'en cas de contrôle surprise, chaque brigade apporte sa boîte d'épices au banc central.",
    sharePrompt: "Rappelle que le contrôle surprise force tous les secrets à sortir en même temps.",
    adminTruth: "Vrai : le contrôle fait bien sortir les réserves."
  },
  "Le noir coupe aussi le filet": {
    headline: "Le monte-plats sert surtout de faux point chaud",
    body:
      "Le monte-plats bouge beaucoup pendant l'émission, même quand rien d'important ne passe dedans. Il attire l'œil, c'est tout.",
    sharePrompt: "Dis qu'un endroit très animé n'est pas forcément le bon.",
    adminTruth: "Vrai : le monte-plats fait surtout diversion."
  },
  "Le monte-charge a été testé trop tard": {
    headline: "La même glacière orange revient en cuisine bleue",
    body:
      "Un assistant plateau a vu la même glacière orange revenir deux fois du côté de la cuisine bleue, pas du monte-plats.",
    sharePrompt: "Glisse que l'objet tourne déjà loin du passage évident.",
    adminTruth: "Vrai : ce signal renforce la piste du contrôle central."
  },
  "La porte quai sonne avec la cabine": {
    headline: "Le chrono laisse juste le temps d'un contrôle",
    body:
      "Le chrono du plateau permet un contrôle surprise central. Après, les brigades seront trop avancées pour qu'il soit utile.",
    sharePrompt: "Rappelle que l'option forte a une vraie fenêtre.",
    adminTruth: "Vrai : la fenêtre de contrôle existe bien."
  },
  "Les visiteurs paniquent vite dans le noir": {
    headline: "Le chef plateau dit qu'un contrôle fait toujours paniquer les brigades",
    body:
      "Le chef plateau dit qu'un contrôle surprise fera forcément partir les brigades dans tous les sens. C'est plausible, mais il dramatise souvent.",
    sharePrompt: "Présente-le comme un risque humain, pas comme une certitude.",
    adminTruth: "Partiel : possible, mais pas assez solide seul."
  },
  "La restauratrice doute de la taille de la caisse": {
    headline: "Deux tabliers staff se ressemblent trop",
    body:
      "Deux tabliers staff semblent presque identiques. Cela suggère des rôles doublés, sans dire où passera l'épice.",
    sharePrompt: "Utilise-le pour nourrir le doute, pas pour conclure trop vite.",
    adminTruth: "Partiel : bon signal d'ambiguïté, pas plus."
  },
  "Le noir garde les lasers intacts": {
    headline: "Le régisseur promet un contrôle sans aucun bazar",
    body:
      "Le régisseur affirme qu'un contrôle surprise se ferait sans bruit, sans retard et sans réaction des chefs. C'est très douteux.",
    sharePrompt: "Questionne toute promesse de plateau parfaitement calme.",
    adminTruth: "Faux : un tel contrôle ne serait pas aussi propre."
  },
  "Les voleurs détestent la lumière": {
    headline: "Le menu affiché suffirait à trouver la brigade coupable",
    body:
      "Un juré improvise en disant que le menu affiché permet déjà de savoir qui cache l'épice. C'est une belle phrase, pas une preuve.",
    sharePrompt: "Traite-le comme une intuition théâtrale, pas comme une info solide.",
    adminTruth: "Faux : le menu ne permet pas de conclure."
  },
  "Une seule grue fait l'affaire": {
    headline: "Une seule pince peut vraiment sortir le coffre",
    body:
      "Le plan des attractions montre qu'une seule grande pince peut soulever le coffre sans le bloquer dans les peluches.",
    sharePrompt: "Ramène le groupe à cette idée simple : un seul outil compte vraiment.",
    adminTruth: "Vrai : la grande pince est bien le point clé."
  },
  "La lumière vous trahit aussi": {
    headline: "Allumer tout le parc vous rend très visible",
    body:
      "Si toutes les lumières s'allument d'un coup, on repère immédiatement où l'équipe se place et ce qu'elle surveille.",
    sharePrompt: "Dis qu'éclairer partout, c'est aussi se dénoncer.",
    adminTruth: "Vrai : la visibilité devient un problème."
  },
  "La marée ne laisse pas le temps de changer de quai": {
    headline: "La fermeture laisse très peu de temps",
    body:
      "La fête ferme bientôt. Changer plusieurs fois de stand ferait perdre le seul bon moment pour récupérer le coffre.",
    sharePrompt: "Rappelle que le temps réduit les faux plans ingénieux.",
    adminTruth: "Vrai : la fenêtre est bien courte."
  },
  "Le trajet sec passe derrière la grue 3": {
    headline: "Le passage facile passe derrière la grande pince",
    body:
      "Le seul trajet encore praticable sans glisser passe derrière la grande pince, pas derrière les autres stands.",
    sharePrompt: "Glisse qu'un passage obligé vaut plus qu'une fouille géante.",
    adminTruth: "Vrai : le bon passage passe bien là."
  },
  "Un plongeur parle d'un second zodiac": {
    headline: "Une foraine croit voir une deuxième camionnette",
    body:
      "Une foraine pense avoir aperçu une deuxième camionnette derrière les stands, mais elle n'en est pas sûre.",
    sharePrompt: "Utilise-le pour ajouter du doute, pas pour refaire tout le plan.",
    adminTruth: "Partiel : possible, sans confirmation."
  },
  "Le panneau de lampes fatigue sous la pluie": {
    headline: "Le tableau des lumières supporte mal la pluie",
    body:
      "Un forain dit que le tableau des lumières lâche parfois quand la pluie devient forte. C'est possible, mais pas certain.",
    sharePrompt: "Présente-le comme un risque technique, pas comme une panne sûre.",
    adminTruth: "Partiel : plausible mais non confirmé."
  },
  "Toutes les grues se valent": {
    headline: "Le patron dit que toutes les pinces se valent",
    body:
      "Le patron prétend que n'importe quelle pince du parc peut attraper le coffre. Le plan des machines dit l'inverse.",
    sharePrompt: "Questionne une phrase trop simple pour être fiable.",
    adminTruth: "Faux : toutes les pinces ne peuvent pas faire le même travail."
  },
  "L'échange est déjà dans la douane": {
    headline: "Une rumeur envoie déjà le coffre à la caisse centrale",
    body:
      "Une rumeur dit que le coffre a déjà quitté les lots pour la caisse centrale. Aucun mouvement réel ne va dans ce sens.",
    sharePrompt: "Traite cela comme un leurre pour détourner le groupe.",
    adminTruth: "Faux : aucune preuve d'un tel déplacement."
  }
};

function oppositeDecision(value: DecisionOptionId): DecisionOptionId {
  return value === "A" ? "B" : "A";
}

function buildDisplayIntruderIds(team: TeamGame): string[] {
  const participantIds = [...team.participants].map((participant) => participant.id).sort();
  if (participantIds.length <= 2) {
    return participantIds;
  }

  const original = [...team.intruderIds].sort().join("|");
  const length = participantIds.length;

  for (let offsetSeed = 0; offsetSeed < length + 2; offsetSeed += 1) {
    const offset =
      Number.parseInt(hashString(`${team.id}-part-two-${offsetSeed}`).slice(0, 6), 36) % length;
    const next = participantIds[offset];
    const second = participantIds[(offset + Math.max(2, Math.floor(length / 2))) % length];
    const picks = Array.from(new Set([next, second]));

    if (picks.length < 2) {
      continue;
    }

    const candidate = [...picks].sort().join("|");
    if (candidate !== original) {
      return picks;
    }
  }

  return participantIds.slice(0, 2);
}

function buildDisplaySabotageBrief(team: DisplayTeamCopy): string {
  const targetOption = team.options.find((option) => option.id === team.sabotageDecision) ?? team.options[0];
  return `Ta mission: fais paraitre "${targetOption.title}" plus simple, plus rassurante et plus fun que l'autre option. Appuie sur la vitesse, le confort ou le spectacle pour faire hésiter le groupe.`;
}

export function getDisplayedTeamCopy(team: TeamGame): DisplayTeamCopy {
  const override = TEAM_COPY_BY_SCENARIO[team.scenarioTitle];
  const correctDecision = override?.correctDecision ?? team.correctDecision;
  const intruderIds = buildDisplayIntruderIds(team);

  return {
    scenarioTitle: override?.scenarioTitle ?? toReadableFrench(team.scenarioTitle),
    atmosphere: override?.atmosphere ?? toReadableFrench(team.atmosphere),
    situation: override?.situation ?? toReadableFrench(team.situation),
    options:
      override?.options ??
      (team.options.map((option) => ({
        ...option,
        title: toReadableFrench(option.title),
        description: toReadableFrench(option.description)
      })) as [DecisionOption, DecisionOption]),
    rationale: override?.rationale ?? toReadableFrench(team.rationale),
    correctDecision,
    sabotageDecision: oppositeDecision(correctDecision),
    intruderIds
  };
}

export function getDisplayedCardCopy(team: TeamGame, card: GeneratedCard): DisplayCardCopy {
  const override = CARD_COPY_BY_HEADLINE[card.headline];
  const displayedTeam = getDisplayedTeamCopy(team);
  const isIntruder = displayedTeam.intruderIds.includes(card.participantId);

  return {
    headline: override?.headline ?? toReadableFrench(card.headline),
    body: override?.body ?? toReadableFrench(card.body),
    sharePrompt: override?.sharePrompt ?? toReadableFrench(card.sharePrompt),
    sabotageBrief: isIntruder ? buildDisplaySabotageBrief(displayedTeam) : null,
    adminTruth: override?.adminTruth ?? toReadableFrench(card.adminTruth),
    isIntruder,
    sabotageChoice: isIntruder ? displayedTeam.sabotageDecision : null
  };
}
