# Connecting a clinic's WhatsApp number

CliniBot uses only the **official WhatsApp Business Platform (Cloud API)**
from Meta. It never uses WhatsApp Web automation, scraping, or a personal
WhatsApp account.

Each clinic connects its own WhatsApp Business number. Until every step
below succeeds, the dashboard shows the integration as **Disconnected** or
**Credentials verified**; it shows **Connected** only after Meta has accepted
the credentials *and* completed the webhook handshake.

## What the clinic needs from Meta (one-time)

1. **Meta Business portfolio** (business.facebook.com) for the clinic, with
   **business verification** completed (commercial registration documents).
   Unverified businesses are limited to a small number of conversations.
2. **A phone number for WhatsApp Business Platform.** It must be able to
   receive an SMS or voice call for verification, and must **not** be active
   on the WhatsApp or WhatsApp Business *app* at the same time (migrate or
   delete it there first).
3. **Display name** approved by Meta (must match the clinic's brand).
4. **A Meta app** (developers.facebook.com → Create app → type *Business*)
   with the **WhatsApp** product added and linked to the business portfolio.
5. In WhatsApp Manager / the app's WhatsApp → API Setup page, note:
   - **Phone number ID** (not the phone number itself)
   - **WhatsApp Business Account ID (WABA ID)**
6. **A permanent access token**: Business Settings → Users → System users →
   add a system user (Admin), assign the app and the WhatsApp account, and
   generate a token with the permissions `whatsapp_business_messaging` and
   `whatsapp_business_management`. Temporary 24-hour tokens from the API
   Setup page will stop working the next day — do not use them in production.
7. **App secret**: App settings → Basic → App secret. CliniBot uses it to
   verify that every webhook call really comes from Meta.

## Connecting in CliniBot

1. Sign in as the clinic **owner or admin** → **WhatsApp**.
2. Enter the phone number ID, WABA ID, access token and app secret → **Save
   and verify**. CliniBot calls Meta with the token. If Meta rejects it,
   nothing is stored and Meta's error is shown.
3. CliniBot then shows a **callback URL** and a **verify token**. Copy the
   verify token now: it is shown once (it can be regenerated).
4. In the Meta app → WhatsApp → Configuration → **Webhook** → Edit:
   - Callback URL: the URL shown by CliniBot
     (`https://<project>.supabase.co/functions/v1/whatsapp-webhook/<key>`)
   - Verify token: the token shown by CliniBot
   - Click **Verify and save**. Meta calls CliniBot; when the token matches,
     the dashboard changes to **Connected**.
5. Under Webhook fields, **subscribe to `messages`** (this also delivers
   delivery and read receipts).
6. Send a WhatsApp message to the clinic number from another phone. It
   should appear under Conversations, and the assistant replies if it is
   enabled.

## Message rules CliniBot follows

- **24-hour customer service window.** Free-form replies are allowed only
  within 24 hours of the customer's last message. CliniBot checks this before
  sending and refuses with `outside_service_window` instead of letting Meta
  reject the message. Outside the window only **approved templates** can be
  sent.
- **Appointment confirmations** outside the window need an approved
  template. In Meta WhatsApp Manager create a **Utility** template whose body
  has exactly three variables in this order: `{{1}}` customer name, `{{2}}`
  date, `{{3}}` time. Example (Arabic):

  > مرحباً {{1}}، تم تأكيد موعدك لدى العيادة بتاريخ {{2}} الساعة {{3}}. للتعديل يرجى التواصل مع الاستقبال.

  After Meta approves it, enter the template name and language under
  WhatsApp → Confirmation template in CliniBot.
- **Opt-in and opt-out.** Only message customers who contacted the clinic or
  agreed to be contacted. Customers who send `STOP` or `إيقاف` stop receiving
  automated replies; staff see the conversation as opted out. `حذف بياناتي` or
  `DELETE MY DATA` deletes the customer's stored messages.
- **Privacy notice.** The first automated reply to a new number includes the
  clinic's privacy notice.
- **Duplicates.** Meta retries webhook deliveries for up to 7 days. Every
  message is stored once by its WhatsApp message id and answered once.
- **Delivery status.** Sent, delivered, read and failed receipts update the
  message in the dashboard; failures show Meta's error code.

## Costs and limits (set by Meta)

Meta charges per conversation/message category according to its current
pricing for Saudi Arabia, and limits how many customers a new number can
start conversations with per day (messaging tiers rise with quality and
volume). Check Meta's pricing page before launch; CliniBot does not add or
hide these charges.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Meta rejected the credentials" with code 190 | Token expired or lacks permissions — generate a system-user token |
| Meta says the callback URL could not be verified | Verify token copied wrongly, or it was regenerated — copy the latest |
| Messages arrive in Meta but not in CliniBot | `messages` webhook field not subscribed, or the app is not subscribed to the WABA (CliniBot attempts this on save) |
| Replies fail with 131047 | 24-hour window closed — use a template |
| Status shows **Error** | Open the WhatsApp page: the last error from Meta is shown there |
