export type Locale = 'en' | 'fr' | 'ar';
export type GuideLanguage = Locale;

export interface LocalizedCopy {
  title: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/* Strict domain schemas (Task 3.2)                                    */
/* ------------------------------------------------------------------ */

/** Plain localized string map — every locale must provide a value. */
export type LocalizedText = {
  ar: string;
  en: string;
  fr: string;
};

export type OpportunityCategory =
  | 'scholarship'
  | 'internship'
  | 'job'
  | 'study_program'
  | 'visa_guide'
  | 'cabin_crew';

export type OpportunityStatus = 'open' | 'closing_soon' | 'closed' | 'archived';

export type StudyLevel =
  | 'high_school'
  | 'bachelor'
  | 'master'
  | 'phd'
  | 'professional'
  | 'all';

export interface OpportunityItem {
  id: string;
  slug: string;
  category: OpportunityCategory;
  status: OpportunityStatus;
  title: LocalizedText;
  description: LocalizedText;
  country: string;
  countryCode?: string;
  location?: LocalizedText;
  deadline?: string | null;
  isFeatured?: boolean;
  stipendOrSalary?: LocalizedText;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  externalUrl?: string;
}

export interface GuideItem {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  destinationCountry: string;
  category: string;
  pdfAssetPath?: string;
  downloadCount?: number;
  isFeatured?: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Capture-source taxonomy for lead submissions. */
export type LeadSource = 'contact_page' | 'guide_download' | 'whatsapp_cta' | 'newsletter';

export interface LeadSubmissionRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  serviceInterest?: string;
  targetCountry?: string;
  studyLevel?: StudyLevel | string;
  source: LeadSource;
  guideSlug?: string;
  message?: string;
  createdAt: string;
}

/** Domain alias used by lead services and admin tables. */
export type LeadRecord = LeadSubmissionRecord;

export interface AdminMetrics {
  totalLeads: number;
  totalGuideDownloads: number;
  totalContactInquiries: number;
  leadsByCountry: Record<string, number>;
  leadsBySource: Record<LeadSource | string, number>;
  dailySubmissions: Array<{ date: string; count: number }>;
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
