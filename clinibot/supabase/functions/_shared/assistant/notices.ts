// Fixed customer-facing texts, in Arabic and English. These are sent without
// the model, so every statement in them must be true whenever they are sent:
// the emergency text is only sent after the conversation was flagged for
// reception, the fallback only after a handoff was recorded.

import type { Language } from "./language.ts";

export interface PrivacyNoticeInput {
  clinicName: string;
  retentionDays: number;
  customAr?: string | null;
  customEn?: string | null;
}

/** The clinic's own notice when it wrote one for this language, otherwise the default. */
export function privacyNotice(language: Language, input: PrivacyNoticeInput): string {
  const custom = (language === "ar" ? input.customAr : input.customEn)?.trim();
  if (custom) return custom;
  if (language === "ar") {
    return `مرحبًا بك في ${input.clinicName}. يرد على رسائلك مساعد آلي، ونحتفظ بالمحادثة لمدة ${input.retentionDays} يومًا ` +
      `لخدمتك والرد عليك، ويطّلع عليها فريق العيادة. لإيقاف الرسائل الآلية أرسل «إيقاف» (STOP)، ` +
      `ولحذف رسائلك أرسل «حذف بياناتي» (DELETE MY DATA) في أي وقت.`;
  }
  return `Welcome to ${input.clinicName}. An automated assistant replies to your messages. We keep this conversation ` +
    `for ${input.retentionDays} days to serve you, and the clinic team can read it. Send STOP (إيقاف) to stop ` +
    `automated messages, or DELETE MY DATA (حذف بياناتي) to delete your messages at any time.`;
}

export function optedOutConfirmation(language: Language): string {
  return language === "ar"
    ? "تم إيقاف الرسائل الآلية، ولن تصلك منا رسائل أخرى في هذه المحادثة. للتواصل مع العيادة لاحقًا يُرجى الاتصال بالاستقبال."
    : "Automated messages are stopped and you will not receive further messages from us in this conversation. " +
      "To reach the clinic later, please call reception.";
}

export function dataDeletedConfirmation(language: Language): string {
  return language === "ar"
    ? "تم حذف رسائلك في هذه المحادثة. إن كنت قد طلبت موعدًا فطلبك محفوظ لدى العيادة لمتابعته، ويمكنك طلب حذفه من الاستقبال."
    : "Your messages in this conversation have been deleted. If you requested an appointment, the clinic keeps that " +
      "request so it can follow up; you can ask reception to delete it.";
}

export const DEFAULT_EMERGENCY_NUMBER = "997";

export function emergencyGuidance(language: Language, emergencyNumber: string | null | undefined): string {
  const number = emergencyNumber?.trim() || DEFAULT_EMERGENCY_NUMBER;
  return language === "ar"
    ? `إذا كانت هذه حالة طارئة فاتصل فورًا على ${number} أو توجّه إلى أقرب قسم طوارئ الآن. ` +
      "لا يمكنني تقديم استشارة طبية، وقد نبّهت فريق الاستقبال في العيادة إلى رسالتك."
    : `If this is an emergency, call ${number} now or go to the nearest emergency department immediately. ` +
      "I can't give medical advice. I have alerted the clinic's reception team to your message.";
}

const UNAVAILABLE: Record<Language, string> = {
  ar: "شكرًا لك، وصلتنا رسالتك. سيرد عليك فريق الاستقبال في أقرب وقت ممكن.",
  en: "Thank you, we have received your message. The clinic's reception team will reply as soon as possible.",
};

/** Sent when the assistant cannot answer. Constant text, so a repeat can be recognised and not sent twice. */
export function unavailableNotice(language: Language): string {
  return UNAVAILABLE[language];
}

export function isUnavailableNotice(body: string | null | undefined): boolean {
  return body === UNAVAILABLE.ar || body === UNAVAILABLE.en;
}

/** Replaces a reply that was refused or withheld; only sent together with a recorded handoff. */
export function safeFallback(language: Language, receptionPhone: string | null | undefined): string {
  const phone = receptionPhone?.trim();
  if (language === "ar") {
    return "عذرًا، لا أستطيع الإجابة عن هذا بدقة. حوّلت رسالتك إلى فريق الاستقبال وسيرد عليك قريبًا." +
      (phone ? ` ويمكنك أيضًا الاتصال بالاستقبال على ${phone}.` : "");
  }
  return "Sorry, I can't answer that accurately. I have passed your message to the reception team and they will " +
    "reply soon." + (phone ? ` You can also call reception on ${phone}.` : "");
}

/** Shown when a web chat starts and the clinic has not written its own welcome. */
export function defaultWelcome(language: Language, clinicName: string): string {
  return language === "ar"
    ? `مرحبًا بك في ${clinicName}! يسعدنا مساعدتك في معرفة خدماتنا وأسعارنا ومواعيد العمل، أو في طلب موعد. كيف نقدر نخدمك؟`
    : `Welcome to ${clinicName}! We can help with our services, prices and working hours, or with an appointment ` +
      "request. How can we help you?";
}
