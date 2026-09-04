# NABD Admin

The back-office plane. Kept as a **separate application** from the customer web
app for reasons that are structural, not cosmetic:

- **Separate authentication realm.** Admin tokens carry a different audience, so
  a customer token can never authenticate against an admin endpoint even if a
  routing bug exposed one.
- **Mandatory MFA.** The API refuses admin login without it.
- **Separate deployment and network exposure.** The admin plane need not be
  reachable from the public internet at all.
- **Separate blast radius.** An XSS in the customer app cannot reach admin
  session state, because they do not share an origin.

Roles and permissions: [`docs/compliance/access-control-matrix.md`](../../docs/compliance/access-control-matrix.md).

The rule that matters most: **no admin role can move customer money.** Value
moves only through a customer-authenticated request, or through an audited
`FINANCE` adjustment or reversal carrying a named operator and a written reason.
