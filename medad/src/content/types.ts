export type ServiceSlug =
  | 'web-design-development'
  | 'e-commerce'
  | 'ui-ux-design'
  | 'brand-digital-experiences';

export type ProjectSlug = 'mubayn' | 'labina' | 'clinibot';
export type BrandSlug = 'mubayn' | 'sahm' | 'dunyaa' | 'labina';

export type ProjectType = 'website' | 'ecommerce' | 'uiux' | 'branding' | 'hospitality' | 'other';
export type Budget = 'lt15' | '15to40' | '40to100' | 'gt100' | 'unsure';

export interface SectionHead {
  index: string;
  label: string;
  labelEn: string;
  heading: string;
  intro: string;
}

export interface Service {
  slug: ServiceSlug;
  title: string;
  titleAlt: string;
  short: string;
  tags: string[];
  detail: {
    lead: string;
    paragraphs: string[];
    includes: string[];
    idealFor: string[];
    outcome: string;
  };
}

export interface Project {
  slug: ProjectSlug;
  name: string;
  /** Secondary name (the other script), if the brand has one. */
  nameAlt: string;
  category: string;
  description: string;
  about: string;
  highlights: string[];
  /** What MEDAD did on the project. */
  scope: string[];
  palette: { name: string; hex: string }[];
  url: string;
  contactType: ProjectType;
}

export interface BrandWork {
  slug: BrandSlug;
  name: string;
  note: string;
}

export interface Dictionary {
  meta: { title: string; description: string; keywords: string[]; ogAlt: string };
  a11y: {
    skip: string;
    menuOpen: string;
    menuClose: string;
    close: string;
    primaryNav: string;
    footerNav: string;
    home: string;
    newTab: string;
    switchTo: string;
    sculpture: string;
  };
  nav: {
    home: string;
    services: string;
    work: string;
    about: string;
    contact: string;
    cta: string;
  };
  lang: { short: string; name: string };
  hero: {
    eyebrow: string;
    wordmark: string;
    headline: string;
    supporting: string;
    ctaPrimary: string;
    ctaSecondary: string;
    scroll: string;
    metaStart: string;
    metaEnd: string;
  };
  philosophy: SectionHead & {
    body: string;
    pillars: { title: string; titleAlt: string; text: string }[];
    result: { title: string; titleAlt: string; text: string };
    quote: string;
  };
  services: SectionHead & { more: string; items: Service[] };
  work: SectionHead & {
    live: string;
    view: string;
    visit: string;
    modal: {
      about: string;
      highlights: string;
      scope: string;
      palette: string;
      close: string;
      next: string;
      prev: string;
      cta: string;
      desktop: string;
      mobile: string;
      scrollHint: string;
    };
    projects: Project[];
    brands: { label: string; heading: string; intro: string; items: BrandWork[] };
  };
  process: SectionHead & {
    deliverables: string;
    steps: { title: string; titleAlt: string; text: string; deliverables: string[] }[];
  };
  why: SectionHead & { items: { title: string; titleAlt: string; text: string }[] };
  cta: { headline: string; supporting: string; button: string; label: string };
  contact: SectionHead & {
    direct: string;
    email: string;
    phone: string;
    whatsapp: string;
    noDirect: string;
    form: {
      title: string;
      name: string;
      namePh: string;
      email: string;
      emailPh: string;
      type: string;
      typePh: string;
      budget: string;
      details: string;
      detailsPh: string;
      honeypot: string;
      submit: string;
      sending: string;
      sendAnother: string;
      required: string;
    };
    projectTypes: { value: ProjectType; label: string }[];
    budgets: { value: Budget; label: string }[];
    errors: {
      required: string;
      name: string;
      email: string;
      details: string;
      tooLong: string;
      choose: string;
      fix: string;
    };
    status: {
      successTitle: string;
      successText: string;
      notConfigured: string;
      notConfiguredEmail: string;
      mailFallback: string;
      mailSubject: string;
      rateLimited: string;
      generic: string;
      network: string;
    };
  };
  footer: {
    tagline: string;
    statement: string;
    navTitle: string;
    contactTitle: string;
    socialTitle: string;
    rights: string;
    backToTop: string;
    formLink: string;
  };
  serviceDetail: {
    back: string;
    included: string;
    idealFor: string;
    outcome: string;
    approach: string;
    next: string;
    all: string;
    ctaTitle: string;
    ctaText: string;
    ctaButton: string;
  };
}
