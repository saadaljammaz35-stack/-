import { signOut } from '@/services/auth/authService';
import { deleteAllPhotos } from '@/services/media/imageService';
import { getSupabase } from '@/services/supabase';
import { getItemService } from '@/state/services';

/**
 * Deletes the account server-side (Edge Function removes storage objects, rows
 * and the auth user with the service role), then erases this device.
 */
export async function deleteAccountEverywhere(): Promise<void> {
  const client = getSupabase();
  if (client) {
    const { data } = await client.auth.getSession();
    if (data.session) {
      const { error } = await client.functions.invoke('account-delete', { body: { confirm: 'DELETE' } });
      if (error) throw new Error(error.message);
    }
  }
  await eraseThisDevice();
  await signOut().catch(() => undefined);
}

export async function eraseThisDevice(): Promise<void> {
  await getItemService().wipeLocal();
  deleteAllPhotos();
}
