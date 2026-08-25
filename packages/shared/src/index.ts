export type WeightClass =
  | "FLYWEIGHT"
  | "BANTAMWEIGHT"
  | "FEATHERWEIGHT"
  | "LIGHTWEIGHT"
  | "WELTERWEIGHT"
  | "MIDDLEWEIGHT"
  | "LIGHT_HEAVYWEIGHT"
  | "HEAVYWEIGHT";

export type ApplicationStatus = "PENDING_REVIEW" | "REJECTED" | "ACCEPTED" | "WITHDRAWN";

export interface Fighter {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  weightClass?: WeightClass | null;
  heightCm?: number | null;
  reachCm?: number | null;
  priorWins: number;
  priorLosses: number;
  priorDraws: number;
  wins: number;
  losses: number;
  draws: number;
  bio?: string | null;
  gym?: string | null;
  hometown?: string | null;
  instagram?: string | null;
  photoKey?: string | null;
  photoUrl?: string | null;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  venue?: string | null;
  status: string;
}

export interface Fight {
  id: string;
  eventId: string;
  fighterAId: string;
  fighterBId: string;
  weightClass?: WeightClass | null;
  winnerId?: string | null;
  method?: string | null;
  round?: number | null;
  time?: string | null;
}

export interface Ranking {
  id: string;
  fighterId: string;
  weightClass: WeightClass;
  rank: number;
}
