export type CardTruth = "true" | "partial" | "false";

export type DecisionOptionId = "A" | "B";

export type VoteChoice = DecisionOptionId;

export interface Participant {
  id: string;
  matricule: string;
  name: string;
  direction: string;
  service: string;
  teamId: string;
  teamName: string;
  location: string;
  note: string;
}

export interface DecisionOption {
  id: DecisionOptionId;
  title: string;
  description: string;
}

export interface CardTemplate {
  headline: string;
  body: string;
  sharePrompt: string;
  adminTruth: string;
}

export interface GeneratedCard extends CardTemplate {
  id: string;
  participantId: string;
  participantName: string;
  teamId: string;
  truthType: CardTruth;
  isIntruder: boolean;
  sabotageChoice: DecisionOptionId | null;
  sabotageBrief: string | null;
}

export interface TeamGame {
  id: string;
  name: string;
  direction: string;
  leadRole: string;
  mixSummary: string;
  participants: Participant[];
  archetype: string;
  scenarioTitle: string;
  atmosphere: string;
  situation: string;
  options: [DecisionOption, DecisionOption];
  correctDecision: DecisionOptionId;
  sabotageDecision: DecisionOptionId;
  rationale: string;
  cards: GeneratedCard[];
  intruderIds: string[];
  truthCounts: Record<CardTruth, number>;
}

export interface GameSnapshot {
  contentVersion: number;
  sourceName: string;
  generatedAt: string;
  participants: Participant[];
  teams: TeamGame[];
}

export interface RestitutionEntry {
  decision: string;
  reliableSignals: string;
  doubtfulSignals: string;
  decisionLogic: string;
  disagreements: string;
  justification: string;
}

export interface WorkbookParseResult {
  participants: Participant[];
  sourceLabel: string;
}

export interface VoteRecord {
  cardId: string;
  teamId: string;
  teamName: string;
  participantId: string;
  participantName: string;
  choice: VoteChoice;
  submittedAt: string;
}

export interface IntruderGuessRecord {
  cardId: string;
  teamId: string;
  participantId: string;
  participantName: string;
  suspectIds: string[];
  suspectNames: string[];
  updatedAt: string;
}

export interface SharedSessionState {
  snapshot: GameSnapshot | null;
  votes: Record<string, VoteRecord>;
  guesses: Record<string, IntruderGuessRecord>;
  updatedAt: string | null;
}
