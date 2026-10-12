/**
 * Message namespace registry. One line per namespace; keys are then used as
 * "ns.key" (e.g. t("onboarding.title")). To add a namespace, create
 * `<ns>.ts` next to this file (copy any existing one) and add one line here.
 */
export { default as common } from "./common";
export { default as auth } from "./auth";
export { default as onboarding } from "./onboarding";
export { default as marketing } from "./marketing";
export { default as legal } from "./legal";
export { default as dashboard } from "./dashboard";
export { default as conversations } from "./conversations";
export { default as appointments } from "./appointments";
export { default as knowledge } from "./knowledge";
export { default as assistant } from "./assistant";
export { default as whatsapp } from "./whatsapp";
export { default as staff } from "./staff";
export { default as billing } from "./billing";
export { default as settings } from "./settings";
export { default as audit } from "./audit";
export { default as chat } from "./chat";
export { default as errors } from "./errors";
