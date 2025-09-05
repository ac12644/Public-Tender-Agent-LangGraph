export type UserProfile = {
  uid: string;
  // preferenze “Per te”
  regions: string[]; // es: ["Lombardia","Lazio"] (NUTS-2 friendly)
  cpv: string[]; // max 3
  daysBack: number; // 0/3/7
  minValueEUR?: number | null; // filtro opzionale
  notifyMorning: boolean; // digest alle 9:00
  createdAt: Date;
  updatedAt: Date;
};

export type SavedSearch = {
  id: string; // doc id
  uid: string;
  country: string; // "ITA"
  daysBack: number;
  cpv: string[];
  text?: string;
  minValueEUR?: number | null;
  regions?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type FavoriteTender = {
  uid: string;
  tenderId: string; // publication-number
  createdAt: Date;
};
