# NABD — Compliance

## 1. Regulatory posture — stated plainly

**NABD is not a licensed bank, and this repository does not make it one.**

Software cannot grant a licence, and no amount of code makes an organisation
compliant. What this codebase does is remove the technical obstacles to
compliance, so that when licences, contracts and controls are in place, the
platform can meet them.

| Claim                                  | Status                                                      |
| -------------------------------------- | ----------------------------------------------------------- |
| NABD is a bank                         | **False.** Never state or imply this.                       |
| NABD holds customer deposits           | **False.** Funds sit with a licensed partner.               |
| NABD moves real money by itself        | **False.** Delegated to a licensed PSP or bank.             |
| This code is "compliant"               | **No.** Compliance is organisational, not a build artifact. |
| This code is _designed for_ compliance | **Yes.** That is exactly its purpose.                       |

### The licensing model NABD targets

NABD is designed as an **electronic money institution (a wallet)**, not a bank.
The distinction is not cosmetic — it changes what is required and what is
possible:

|                       | Bank                         | Electronic money institution                                                  |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Licence               | Full banking licence         | EMI authorisation from the regulator                                          |
| Takes deposits        | Yes                          | **No** — customer funds are held in a safeguarding account at a licensed bank |
| Lends                 | Yes                          | **No**                                                                        |
| Capital requirement   | Very high                    | Substantially lower                                                           |
| Internal P2P transfer | Settles across banking rails | **Settles inside the platform's own ledger**                                  |

That last row is why a wallet transfer is instant and free while a bank transfer
is neither: no external rail is involved. NABD's `internalTransfer` posting rule
is exactly this — a debit to one customer's liability account and a credit to
another's, with the platform's total liability unchanged.

**Safeguarding.** Because NABD does not take deposits, customer balances are a
liability matched by funds held at a licensed partner. The
`system:settlement:<ccy>` asset account exists to represent exactly that, and
the `ledger_reconciliation` view is what proves — continuously — that the
liability to customers is matched by the asset held on their behalf. An EMI that
cannot demonstrate this at any moment is not safeguarding client money; it is
merely asserting that it does.

Permitted naming: **NABD**, **نَبض**, **NABD FinTech Platform**.
Prohibited until licensed: **NABD Bank**, **بنك نَبض**, or any wording implying
deposit-taking, lending, or payment services provided by NABD in its own right.

## 2. What is genuinely required before handling real money

Engineering is one column of this table. The others are not optional.

| Requirement                                             | Owner             | Status                        |
| ------------------------------------------------------- | ----------------- | ----------------------------- |
| Licence or agency arrangement with a licensed entity    | Legal / Executive | **Not started — blocking**    |
| Contract with a licensed PSP / bank                     | Commercial        | **Not started — blocking**    |
| Regulatory approval for the specific activity           | Legal             | **Not started — blocking**    |
| AML/CFT programme, appointed officer, reporting channel | Compliance        | **Not started — blocking**    |
| Independent security assessment / penetration test      | Security          | Not started                   |
| Data-protection assessment and lawful basis             | Legal / DPO       | Not started                   |
| Financial audit of the ledger and reconciliation        | Finance           | Ledger is auditable by design |
| Business continuity and disaster recovery testing       | Operations        | Documented, untested          |
| Technical platform                                      | Engineering       | **Phases 1–2 complete**       |

## 3. Designed-for-compliance properties

These are engineering facts, verified by the test suite, not compliance claims.

**Auditability.** Every financial movement is an immutable double-entry journal.
Nothing is edited or deleted; corrections are reversal journals. `audit_logs`
records who, what, when, IP, device, before, after and reason, and rejects
`UPDATE` and `DELETE` at the database level — including for a super admin.

**Reconstructability.** Any balance at any past point can be re-derived from
`ledger_entries` alone. The `ledger_reconciliation` view compares the cache to a
from-scratch derivation; the `ledger_trial_balance` view asserts total debits
equal total credits per currency.

**Traceability.** Every transaction carries a reference, an idempotency key and
a risk score. Every external call carries our reference as the provider's
idempotency key, so both sides can trace one operation.

**Data minimisation.** Identity documents live in encrypted object storage, not
the database. PII columns are application-encrypted. Card data is not held at
all.

**Consent.** `consents` records scope, purpose, third party, grant and
revocation. Customers can list what they have consented to, see who accessed
what, and revoke.

## 4. AML / CFT architecture

Every screening dependency is an adapter with a `Mock` implementation. The mocks
exist so the workflow can be built and tested end to end.

> **A mock sanctions screen is not a sanctions screen.** Mock adapters must
> never be presented as, or relied upon as, real screening. `handlesRealValue`
> is `false` on every mock, and production refuses to boot with one selected.

| Capability             | Interface                 | Real implementation       |
| ---------------------- | ------------------------- | ------------------------- |
| Identity verification  | `KycProvider`             | Licensed IDV vendor       |
| Sanctions screening    | `SanctionsProvider`       | Licensed screening vendor |
| PEP screening          | `PepProvider`             | Licensed screening vendor |
| Transaction monitoring | `assessFraudRisk` + rules | Vendor or trained model   |
| Case management        | `ComplianceCase`          | In platform               |
| Regulatory reporting   | Manual + export           | Per regulator's channel   |

Risk scoring is a deliberately transparent weighted rule engine rather than an
opaque model. At this stage explainability matters more than accuracy: a
compliance officer must be able to answer "why was this blocked" from the stored
signals, and every point of a score maps to a named, human-readable reason.

**No single rule makes a final decision.** The engine returns a recommendation;
policy applies it, and anything above the review threshold goes to a human queue
rather than being silently allowed or silently dropped.

## 5. Detailed policies

See [`docs/compliance/`](./docs/compliance/):

- `compliance-checklist.md` — what must be true before launch
- `data-classification.md` — four tiers and the handling rules for each
- `data-retention-policy.md` — retention periods and deletion procedures
- `access-control-matrix.md` — role × resource × operation
- `incident-response-plan.md` — severity levels, roles, timelines
- `business-continuity-plan.md` — critical functions and degraded operation
- `disaster-recovery-plan.md` — RPO, RTO, restore procedures

## 6. Open Banking

The integration layer is designed for account information and payment
initiation, with consent management as a first-class entity: explicit scopes,
expiry, revocation, and an audit trail of every access made under a consent. It
will be aligned to the applicable Saudi Open Banking specification at the point
of actual integration. Until then, no claim of conformance is made.
