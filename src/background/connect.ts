// Connecting from the dashboard: its connect page hands the extension a
// key for the account signed in there, so no password is typed into the
// panel.
import { WeraApi } from '../shared/api';
import { DEFAULT_SERVER, loadSession, pendingServer, saveSession, setPendingServer } from '../shared/storage';

/**
 * Keeps a key the dashboard at `from` handed over, once the server says it
 * works. Only the user's own Wera may connect it (or the default one,
 * before they have one), and only with an extension key.
 */
export async function acceptDashboardKey(from: string, token: unknown, me = (server: string, key: string) => new WeraApi(server, key).me()): Promise<boolean> {
  const s = await loadSession();
  // Signed out, the other server the user chose in the panel may connect too.
  const pending = s ? null : await pendingServer();
  if ((from !== (s?.server ?? DEFAULT_SERVER) && from !== pending) || typeof token !== 'string' || !token.startsWith('wera_ext_')) return false;
  try {
    const { user } = await me(from, token);
    await saveSession({ server: from, token, user });
    await setPendingServer(null);
    return true;
  } catch {
    return false;
  }
}
