// Today's Quran portion, for the icon's quick action and Siri.
import { Redirect, type Href } from 'expo-router';

import { wirdRoute } from '@/features/smart-routes';

export default function Wird() {
  return <Redirect href={wirdRoute() as Href} />;
}
