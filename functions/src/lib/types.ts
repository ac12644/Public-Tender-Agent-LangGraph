export type TenderLinks = {
  xml?: Record<string, string>;
  pdf?: Record<string, string>;
  pdfs?: Record<string, string>;
  html?: Record<string, string>;
  htmlDirect?: Record<string, string>;
};

export type TenderDoc = {
  id: string; // publication-number
  title: string;
  buyer: string;
  publicationDate?: string;
  deadline?: string;
  cpv?: string | string[] | null;
  nuts?: string | null;
  links?: TenderLinks;
  summary_it?: string | null;
  summary_en?: string | null;
  processed?: boolean;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
};
