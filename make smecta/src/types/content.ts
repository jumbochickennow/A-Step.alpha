export type Locale = 'en' | 'fr' | 'ar';
export type GuideLanguage = Locale;

export interface LocalizedCopy {
  title: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/* Legacy catalog models (admin dashboard & public pages)              */
/* ------------------------------------------------------------------ */

export interface Guide {
  id: string;
  slug: string;
  category: string;
  filePath: string | null;
  r2KeyEn?: string | null;
  r2KeyFr?: string | null;
  r2KeyAr?: string | null;
  availableLanguages?: Record<GuideLanguage, boolean>;
  fileType: string;
  pageCount: number;
  coverPath: string | null;
  published: boolean;
  sortOrder: number;
  contentUpdatedAt: string;
  translations: Record<Locale, LocalizedCopy>;
}

export interface Opportunity {
  id: string;
  slug: string;
  country: string;
  categories: string[];
  imagePath: string | null;
  applyUrl: string | null;
  opensAt: string | null;
  deadline: string | null;
  featured: boolean;
  published: boolean;
  translations: Record<Locale, LocalizedCopy>;
}

export interface LocalizedGuide extends Omit<Guide, 'translations'>, LocalizedCopy {}
export interface LocalizedOpportunity extends Omit<Opportunity, 'translations'>, LocalizedCopy {}
