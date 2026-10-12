import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation";

// Error messages are i18n keys; useForm() translates them.

export const emailSchema = z
  .string()
  .trim()
  .min(1, "auth.emailInvalid")
  .pipe(z.email("auth.emailInvalid"));

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

export const newPasswordSchema = z
  .string()
  .min(1, "auth.passwordRequired")
  .min(PASSWORD_MIN, "auth.passwordTooShort")
  .refine((value) => utf8Length(value) <= PASSWORD_MAX, "auth.passwordTooLong");

export const fullNameSchema = z.string().trim().min(2, "auth.nameRequired").max(120, "auth.nameTooLong");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "auth.passwordRequired"),
});

export const registerSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  acceptTerms: z.boolean().refine((value) => value, "auth.termsRequired"),
});

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "auth.passwordRequired"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "auth.passwordsDontMatch",
    path: ["confirmPassword"],
  });

export const acceptInviteSchema = z
  .object({
    fullName: fullNameSchema,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "auth.passwordRequired"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "auth.passwordsDontMatch",
    path: ["confirmPassword"],
  });

/** Where Supabase email links come back to (must be in Auth → URL Configuration → Redirect URLs). */
export function authRedirectUrl(path: "/auth/callback" | "/reset-password" | "/auth/accept-invite"): string {
  return `${window.location.origin}${path}`;
}
