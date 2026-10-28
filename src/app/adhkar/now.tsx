// The adhkar of this moment (morning or evening), for the icon's quick action and Siri.
import { Redirect } from 'expo-router';

import { adhkarOfTheMoment } from '@/features/smart-routes';

export default function AdhkarNow() {
  return <Redirect href={`/adhkar/${adhkarOfTheMoment()}`} />;
}
