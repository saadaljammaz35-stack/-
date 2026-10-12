# Saudi regulatory checklist (before production launch)

> **CliniBot does not claim compliance with any Saudi law or standard.**
> This document lists the requirements that are likely to apply, what the
> software already does to support them, and what the business must still
> verify with qualified Saudi legal and cybersecurity advisers. It is not
> legal advice.

Facts below were checked in October 2026 against public summaries of the
regulations. Rules change; confirm each item against the regulator's own
publications before launch.

## 1. Personal Data Protection Law (PDPL)

The PDPL (Royal Decree M/19, amended by M/148) is enforced by the Saudi Data &
AI Authority (SDAIA) and has been fully in force since **14 September 2024**.

| Requirement (summary) | Applies to CliniBot because… | What the software does | What you must still do |
| --- | --- | --- | --- |
| Lawful basis and purpose limitation | Clinics' customers send names, phone numbers and questions | Collects only name and phone for appointment requests; the assistant is instructed never to ask for ID, insurance numbers or medical history | Decide and document the legal basis for each processing purpose (with counsel) |
| **Health data is sensitive data** | Patients may describe symptoms in chat even when not asked | Medical questions are handed to humans; no diagnosis; no medical records are kept | Treat every conversation as potentially containing health data; apply sensitive-data controls; check Ministry of Health requirements |
| Privacy notice | Patients chat with the assistant | Web chat requires accepting a privacy notice before the first message; WhatsApp sends a notice on first contact; both are editable per clinic | Have counsel approve the Arabic and English wording of `/privacy`, the in-chat notice and the WhatsApp notice |
| Data subject rights (access, correction, deletion) | Patients' data is stored | Patients can delete their own web chat; WhatsApp `حذف بياناتي` / `DELETE MY DATA` deletes their messages; clinics can delete conversations and requests; owners can delete the whole clinic | Define the process and response time for access and correction requests (staff can read and export from the dashboard) |
| Retention limited to purpose | Conversations and requests | Per-clinic retention for messages (7–1825 days, default 180) and requests (30–3650, default 365), enforced by a nightly purge; audit logs kept 2 years without personal data | Set retention periods per clinic with counsel |
| Security of processing | — | See `SECURITY.md`: RLS tenant isolation, role-based access, encryption in transit and at rest, encrypted integration credentials, audit log, rate limits | Independent penetration test before launch |
| **Breach notification**: notify SDAIA within **72 hours** of becoming aware (where required) and inform affected people without undue delay | — | Audit log and function logs support investigation | Write the incident response plan and assign owners (see `SECURITY.md`) |
| Records of processing / DPO | Depending on scale and type of processing | — | Assess whether a Data Protection Officer and registration on SDAIA's National Data Governance Platform are required |
| Controller / processor roles | Each clinic decides why patient data is processed; CliniBot processes it for them | Strict tenant isolation | Data Processing Agreement between CliniBot and each clinic |

### Cross-border transfers (important)

The **Regulation on Personal Data Transfer outside the Kingdom** (updated
**1 September 2024**) applies when personal data leaves Saudi Arabia. Without
an adequacy decision, transfers need appropriate safeguards (SDAIA standard
contractual clauses, binding corporate rules or certification), and a **risk
assessment** is required for continuous or large-scale transfers of
sensitive data.

The current deployment transfers data outside the Kingdom in two places:

| Data | Destination | Why |
| --- | --- | --- |
| All stored data (database, auth) | Supabase, **Frankfurt (eu-central-1)** | No Supabase region in KSA/GCC |
| Text of each customer message and the clinic's knowledge, per AI reply | Anthropic API (Claude) | AI responses |
| WhatsApp messages | Meta (WhatsApp Business Platform) | Channel provider |

Before launch, with counsel: complete the transfer risk assessment, put the
SDAIA SCCs (or another valid safeguard) in place with each provider, and
decide whether health-sector customers require in-Kingdom hosting. If they do,
the database layer must move to a KSA-hosted Postgres (the schema, RLS and
functions are plain PostgreSQL and portable).

## 2. Health sector

- Ministry of Health rules on health information, advertising of health
  services, and patient communication may apply to clinic messaging.
  CliniBot does not diagnose, prescribe or give medical advice, and escalates
  medical questions to staff — keep it that way and have the clinic's medical
  director approve the assistant's rules.
- Emergency guidance points to **997** (Saudi Red Crescent) by default;
  each clinic can change the number.
- The assistant only takes appointment **requests**. Customers are told a
  booking is confirmed only after staff confirm it in the dashboard.

## 3. Cybersecurity

- **NCA Essential Cybersecurity Controls (ECC)** and **Cloud Cybersecurity
  Controls (CCC)** are mandatory for government and critical national
  infrastructure, and healthcare customers increasingly require evidence of
  alignment. Map the controls in `SECURITY.md` to ECC/CCC and close the gaps.
- **CST Cloud Computing Regulatory Framework**: check data classification and
  hosting requirements for cloud services offered in the Kingdom.

## 4. Commercial and billing

- Commercial registration for the CliniBot business; terms of service and
  privacy policy reviewed by counsel (drafts are at `/terms` and `/privacy`).
- **VAT at 15%** and **ZATCA e-invoicing (FATOORA)** once subscriptions are
  charged. Prices on the site are shown excluding VAT and labelled as proposed.
- **Payments**: use a SAMA-licensed payment service provider. Card data must
  never touch CliniBot's servers or database (hosted checkout or tokenisation
  only). Payments are not enabled; see `BILLING.md`.
- **E-Commerce Law / consumer protection**: clear pricing, cancellation and
  refund terms before taking payment.

## 5. WhatsApp

Meta's WhatsApp Business Policy and Commerce Policy apply: opt-in before
business-initiated messages, approved templates outside the 24-hour window,
prompt honouring of opt-outs (CliniBot stops automated replies on `STOP` /
`إيقاف`). Healthcare messaging has extra restrictions in Meta's policies —
review them for each clinic's use. See `WHATSAPP-SETUP.md`.

## Launch gate

Do not describe CliniBot as "compliant" with PDPL, NCA or MOH requirements
until each item above has been verified and signed off by the responsible
adviser, and the evidence is kept on file.
