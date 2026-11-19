import 'server-only';

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  siteUrl: read('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000',
  supabaseUrl: read('NEXT_PUBLIC_SUPABASE_URL') ?? '',
  supabaseAnonKey: read('NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? '',
  supabaseServiceKey: read('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  superAdminEmail: read('SUPER_ADMIN_EMAIL'),
  paymentProvider: (read('PAYMENT_PROVIDER') ?? 'moyasar') as 'moyasar' | 'simulator',
  moyasarPublishableKey: read('NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY'),
  moyasarSecretKey: read('MOYASAR_SECRET_KEY'),
  moyasarWebhookSecret: read('MOYASAR_WEBHOOK_SECRET'),
  moyasarApplePayLabel: read('MOYASAR_APPLE_PAY_LABEL') ?? 'SAMAT',
  emailProvider: (read('EMAIL_PROVIDER') ?? 'none') as 'resend' | 'smtp' | 'none',
  emailFrom: read('EMAIL_FROM') ?? 'SAMAT <no-reply@example.com>',
  resendApiKey: read('RESEND_API_KEY'),
  smtp: {
    host: read('SMTP_HOST'),
    port: Number(read('SMTP_PORT') ?? 587),
    user: read('SMTP_USER'),
    pass: read('SMTP_PASS'),
    secure: read('SMTP_SECURE') === 'true',
  },
  smsProvider: (read('SMS_PROVIDER') ?? 'none') as 'unifonic' | 'taqnyat' | 'twilio' | 'none',
  smsSender: read('SMS_SENDER_NAME') ?? 'SAMAT',
  unifonicAppSid: read('UNIFONIC_APP_SID'),
  taqnyatToken: read('TAQNYAT_BEARER_TOKEN'),
  twilio: { sid: read('TWILIO_ACCOUNT_SID'), token: read('TWILIO_AUTH_TOKEN'), from: read('TWILIO_FROM') },
  sendSmsHookSecrets: read('SEND_SMS_HOOK_SECRETS'),
  whatsapp: {
    enabled: read('WHATSAPP_ENABLED') === 'true',
    phoneNumberId: read('WHATSAPP_PHONE_NUMBER_ID'),
    token: read('WHATSAPP_ACCESS_TOKEN'),
    langAr: read('WHATSAPP_TEMPLATE_LANG_AR') ?? 'ar',
    langEn: read('WHATSAPP_TEMPLATE_LANG_EN') ?? 'en',
  },
  anthropicApiKey: read('ANTHROPIC_API_KEY'),
  aiModel: read('SAMAT_AI_MODEL') ?? 'claude-opus-5-5',
  cronSecret: read('CRON_SECRET'),
  printBridgeToken: read('PRINT_BRIDGE_TOKEN'),
};

/** The payment simulator exists for local end-to-end tests only. It can never run in production. */
export function simulatorAllowed(): boolean {
  return env.paymentProvider === 'simulator' && !isProduction;
}
