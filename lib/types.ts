export type TenderDoc = {
  id: string; // publication-number
  title: string;
  buyer?: string;
  cpv?: string;
  nuts?: string;
  deadline?: string; // ISO
  summary_it?: string;
  summary_en?: string;
  processed?: boolean;
  score?: number; // optional personalized score
};
