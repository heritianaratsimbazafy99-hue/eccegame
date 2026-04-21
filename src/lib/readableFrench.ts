interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
}

const REPLACEMENTS: ReplacementRule[] = [
  { pattern: /quatuor à cordes très fier de lui/gi, replacement: "orchestre très sûr de lui" },
  { pattern: /Une micro-carte/gi, replacement: "Une petite carte" },
  { pattern: /Deux stratégies s'opposent/gi, replacement: "Deux plans sont possibles" },
  { pattern: /Deux plans s'affrontent/gi, replacement: "Deux plans sont possibles" },
  { pattern: /figer toute la salle/gi, replacement: "bloquer toute la salle" },
  { pattern: /Geler toute la salle/gi, replacement: "Bloquer toute la salle" },
  { pattern: /laisser le gala respirer/gi, replacement: "laisser le gala continuer" },
  { pattern: /intercepter l'échange/gi, replacement: "arrêter l'échange" },
  { pattern: /Le grand gel de salle/gi, replacement: "Bloquer toute la salle" },
  { pattern: /franchi deux fois le cordon/gi, replacement: "passés deux fois la zone" },
  { pattern: /écran de fuite/gi, replacement: "couverture idéale pour fuir" },
  { pattern: /interception ciblée/gi, replacement: "interception précise" },
  { pattern: /se lèvent d'un bloc/gi, replacement: "se lèvent d'un coup" },
  { pattern: /quasi identiques/gi, replacement: "presque identiques" },
  { pattern: /verrouillage total/gi, replacement: "blocage total" },
  { pattern: /file sous la pluie/gi, replacement: "avance sous la pluie" },
  {
    pattern: /miser sur un vol de badge du contrôleur/gi,
    replacement: "tenter de prendre le badge du contrôleur"
  },
  { pattern: /filer les suspects à distance/gi, replacement: "suivre les suspects à distance" },
  { pattern: /Le plan du badge paraissait élégant/gi, replacement: "Le plan du badge semblait malin" },
  { pattern: /montage humain trop fragile/gi, replacement: "organisation trop fragile" },
  { pattern: /favorise l'interception immédiate/gi, replacement: "pousse à agir tout de suite" },
  { pattern: /belle filature après coup/gi, replacement: "joli suivi après coup" },
  { pattern: /détourner le vrai contrôleur/gi, replacement: "occuper le vrai contrôleur" },
  { pattern: /enlève des options au lieu d'en offrir/gi, replacement: "ferme des portes au lieu d'en ouvrir" },
  { pattern: /plans de cascade/gi, replacement: "plans trop acrobatiques" },
  {
    pattern: /Sers-t'en comme indice de circulation du contrôleur/gi,
    replacement: "Utilise-le comme indice sur les déplacements du contrôleur"
  },
  {
    pattern: /Pose-le comme élément de fragilité/gi,
    replacement: "Présente-le comme un signe de fragilité"
  },
  { pattern: /Deux plans divisent l'équipe/gi, replacement: "Deux plans divisent le groupe" },
  { pattern: /Piéger la sortie du monte-charge/gi, replacement: "Surveiller la sortie du monte-charge" },
  { pattern: /capturer l'échange/gi, replacement: "attraper l'échange" },
  { pattern: /point logistique le plus obligé/gi, replacement: "point de passage obligatoire" },
  { pattern: /point logistique inévitable/gi, replacement: "point de passage obligé" },
  {
    pattern: /rendait l'aile bien plus dure à lire/gi,
    replacement: "rendait la zone bien plus difficile à surveiller"
  },
  { pattern: /routes obligatoires/gi, replacement: "passages obligés" },
  {
    pattern: /n'annule pas juste la vue des autres/gi,
    replacement: "ne gêne pas seulement la vue des autres"
  },
  { pattern: /grand effet de théâtre/gi, replacement: "grand effet spectaculaire" },
  { pattern: /La porte quai/gi, replacement: "La porte du quai" },
  { pattern: /grand noir total/gi, replacement: "black-out total" },
  {
    pattern: /cela dépend beaucoup de qui est présent/gi,
    replacement: "cela dépend beaucoup des personnes présentes"
  },
  { pattern: /peut tout faire/gi, replacement: "peut passer partout" },
  { pattern: /noyé de brouillard/gi, replacement: "plein de brouillard" },
  { pattern: /laisser la brume vivre/gi, replacement: "laisser la brume en place" },
  { pattern: /de manipuler le coffre/gi, replacement: "de soulever le coffre" },
  { pattern: /donnaient surtout l'alerte/gi, replacement: "alerteraient surtout les autres" },
  { pattern: /dégradaient la discrétion/gi, replacement: "feraient perdre en discrétion" },
  { pattern: /bonne tête de crochet/gi, replacement: "bon crochet" },
  { pattern: /s'éclairer soi-même encore plus/gi, replacement: "se rendre encore plus visible" },
  {
    pattern: /réduit beaucoup la liberté réelle des suspects/gi,
    replacement: "laisse peu de liberté aux suspects"
  },
  { pattern: /grand bain de lumière/gi, replacement: "plein de lumière" },
  { pattern: /refaire tout le plan dessus/gi, replacement: "refaire tout le plan à partir de ça" },
  { pattern: /saute souvent quand l'humidité grimpe/gi, replacement: "lâche souvent quand l'humidité monte" },
  { pattern: /opinion très chic/gi, replacement: "avis très chic" },
  { pattern: /leurre parfait/gi, replacement: "bon leurre" }
];

export function toReadableFrench(text: string): string {
  return REPLACEMENTS.reduce(
    (current, rule) => current.replace(rule.pattern, rule.replacement),
    text
  )
    .replace(/\s{2,}/g, " ")
    .trim();
}
