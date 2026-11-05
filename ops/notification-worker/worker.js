export default {
  async scheduled(_event, env) {
    const response = await fetch('https://www.fleetpilot360.com/api/lead-notifications', {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      redirect: 'error',
      signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) throw new Error(`Notification worker returned HTTP ${response.status}`);
    const result = await response.json();
    if (!Number.isInteger(result.processed) || result.overdue !== 0) {
      throw new Error('Unexpected notification worker response');
    }
  },
};
