# Subscriptions and billing

**Payments are not enabled.** No payment provider is integrated or tested,
so the app never asks for card details and never claims a payment was taken.
Prices on the site are labelled *proposed*.

## Plans (proposed, SAR per month, excluding 15% VAT)

| Plan | Price | AI replies / month | Staff seats |
| --- | --- | --- | --- |
| Starter | 299 | 1,000 | 3 |
| Growth | 699 | 5,000 | 6 |
| Pro | 1,499 | 15,000 | 15 |

The source of truth is the `plan_limits` table; the pricing page reads it.

A new clinic starts a **14-day trial** on Starter with a cap of 300 AI replies
(including assistant tests), so a trial cannot run up large AI costs.

## How entitlements are enforced

The browser never decides what a clinic may use. `org_entitlements(org)`
(SQL) computes it from `subscription_records`, which only the service role can
write, and is checked:

| Check | Where |
| --- | --- |
| Assistant replies to patients only while the subscription is active and AI replies remain | assistant pipeline (`_shared/assistant/pipeline.ts`) |
| Owner test runs | `assistant-test` |
| Staff seats | `invite-member` and a database trigger on `organization_members` |

When a trial ends without a plan, patients' messages are still received and
shown to staff; the assistant stops replying and tells the customer that
reception will reply.

## Activating a plan by hand (until a provider is integrated)

After receiving payment and issuing a ZATCA-compliant invoice, in the SQL
editor:

```sql
-- close the current record
update public.subscription_records
   set status = 'expired', updated_at = now()
 where organization_id = '<clinic id>' and status in ('trialing', 'active', 'past_due');

-- start the paid period
insert into public.subscription_records
  (organization_id, plan, status, current_period_start, current_period_end, provider, notes)
values
  ('<clinic id>', 'growth', 'active', now(), now() + interval '1 month', 'manual', 'Invoice INV-0001');
```

Both changes are written to the audit log automatically.

## Integrating a payment provider (to do)

1. Choose a SAMA-licensed PSP (for example Moyasar, HyperPay, Tap or
   PayTabs) and use its **hosted checkout / tokenisation** so card data never
   touches CliniBot.
2. Add an Edge Function `billing-checkout` (owner only) that creates a
   checkout session server-side and returns the redirect URL.
3. Add an Edge Function `billing-webhook` that verifies the provider's
   signature, is idempotent on the provider's event id, and writes
   `subscription_records` (`provider`, `provider_customer_ref`,
   `provider_subscription_ref`, period dates). Never trust a status sent by
   the browser.
4. Generate e-invoices through a ZATCA (FATOORA) integrated solution.
5. Test end to end in the provider's sandbox, then switch the billing page's
   "Payments not enabled" notice off — only then.
