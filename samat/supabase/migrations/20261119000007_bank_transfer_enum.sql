-- Bank transfer: the customer transfers to the restaurant's IBAN and uploads the receipt; staff
-- verify the money arrived before accepting. (Enum value in its own migration so it is committed
-- before the next migration uses it.)
alter type public.payment_status add value if not exists 'pending_verification' after 'initiated';
