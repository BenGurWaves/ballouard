/**
 * GET /api/pipeline/progress?email=...
 *
 * Returns real-time pipeline progress for the dashboard to poll.
 * Shows which agent is currently running, percentage, and messages.
 */
import { json, err, corsPreflightResponse, getKV } from '../../_lib/helpers.js';

export async function onRequestGet(context) {
  const kv = getKV(context.env);
  if (!kv) return err('Storage not configured', 500);

  const url = new URL(context.request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return err('email query parameter required');

  try {
    const progress = await kv.get('progress:' + email, { type: 'json' });
    if (!progress) return json({ status: 'idle', percent: 0, message: 'No active pipeline' });
    return json(progress);
  } catch {
    return json({ status: 'idle', percent: 0, message: 'No active pipeline' });
  }
}

export async function onRequestOptions() {
  return corsPreflightResponse();
}
