import { notFound } from 'next/navigation';

/** Any unknown path inside a locale renders the branded 404 within the site layout. */
export default function CatchAll() {
  notFound();
}
