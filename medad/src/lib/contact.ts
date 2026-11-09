import type { Budget, ProjectType } from '@/content/types';

/**
 * Contact form validation, shared by the browser form and the API route so
 * both apply exactly the same rules.
 */

export const PROJECT_TYPES: readonly ProjectType[] = [
  'website',
  'ecommerce',
  'uiux',
  'branding',
  'hospitality',
  'other',
];
export const BUDGETS: readonly Budget[] = ['lt15', '15to40', '40to100', 'gt100', 'unsure'];

export const LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  details: { min: 20, max: 4000 },
} as const;

export type ContactField = 'name' | 'email' | 'projectType' | 'budget' | 'details';
export type ContactErrorCode = 'required' | 'name' | 'email' | 'details' | 'tooLong' | 'choose';

export interface ContactInput {
  name: string;
  email: string;
  projectType: ProjectType | '';
  budget: Budget | '';
  details: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  projectType: ProjectType;
  budget: Budget;
  details: string;
}

export type ContactErrors = Partial<Record<ContactField, ContactErrorCode>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateField(field: ContactField, raw: unknown): ContactErrorCode | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  switch (field) {
    case 'name':
      if (!value) return 'required';
      if (value.length > LIMITS.name.max) return 'tooLong';
      if (value.length < LIMITS.name.min) return 'name';
      return null;
    case 'email':
      if (!value) return 'required';
      if (value.length > LIMITS.email.max) return 'tooLong';
      if (!EMAIL_RE.test(value)) return 'email';
      return null;
    case 'projectType':
      return (PROJECT_TYPES as readonly string[]).includes(value) ? null : 'choose';
    case 'budget':
      return (BUDGETS as readonly string[]).includes(value) ? null : 'choose';
    case 'details':
      if (!value) return 'required';
      if (value.length > LIMITS.details.max) return 'tooLong';
      if (value.length < LIMITS.details.min) return 'details';
      return null;
  }
}

export const CONTACT_FIELDS: readonly ContactField[] = [
  'name',
  'email',
  'projectType',
  'budget',
  'details',
];

export function validateContact(
  input: Record<string, unknown>,
): { ok: true; data: ContactPayload } | { ok: false; errors: ContactErrors } {
  const errors: ContactErrors = {};
  for (const field of CONTACT_FIELDS) {
    const code = validateField(field, input[field]);
    if (code) errors[field] = code;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const str = (k: ContactField) => String(input[k]).trim();
  return {
    ok: true,
    data: {
      name: str('name'),
      email: str('email'),
      projectType: str('projectType') as ProjectType,
      budget: str('budget') as Budget,
      details: str('details'),
    },
  };
}

/** Response shape of `POST /api/contact`. */
export type ContactResponse =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid' | 'not_configured' | 'rate_limited' | 'delivery_failed' | 'bad_request';
      fields?: ContactErrors;
    };
