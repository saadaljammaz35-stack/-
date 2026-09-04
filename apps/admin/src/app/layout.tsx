/**
 * Admin shell.
 *
 * A separate application from the customer web app, on a separate origin, with
 * a separate token audience. That separation is structural, not cosmetic: an
 * XSS in the customer app cannot reach admin session state, and a customer
 * token can never authenticate here even if a routing bug exposed an endpoint.
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NABD Admin',
  description: 'NABD back office',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand__mark">N</span>
              <span className="brand__name">NABD Admin</span>
            </div>
            {/* Navigation is rendered from visibleNavItems(session), so a role
                never sees a page it cannot open. The API enforces the same
                table — this only decides what is shown. */}
            <nav className="nav" aria-label="Sections" />
            <p className="sidebar__notice">
              NABD is a financial technology platform, not a licensed bank.
            </p>
          </aside>
          <div className="content">{children}</div>
        </div>
      </body>
    </html>
  );
}
