import { readConfig } from './config.mjs';
import { HELPER_ORIGIN, requireThat } from './contracts.mjs';

export async function validateClientProfile(env = process.env, read = readConfig) {
  requireThat(env.AGENT_BROWSER_PROVIDER === 'kernel' && env.KERNEL_ENDPOINT === HELPER_ORIGIN &&
    env.KERNEL_API_KEY && env.KERNEL_HEADLESS === 'true' && env.KERNEL_STEALTH === 'false', 'CLIENT_PROFILE_CONFLICT');
  for (const key of ['AGENT_BROWSER_EXECUTABLE_PATH', 'AGENT_BROWSER_CDP', 'AGENT_BROWSER_AUTO_CONNECT',
    'AGENT_BROWSER_PROFILE', 'KERNEL_PROFILE_NAME']) requireThat(!env[key], 'CLIENT_PROFILE_CONFLICT');
  requireThat(env.AGENT_BROWSER_ACTION_POLICY === '/opt/openrind/browser/agent-browser-policy.json', 'CLIENT_POLICY_REQUIRED');
  const policy = await read(env.AGENT_BROWSER_ACTION_POLICY, { uid: 0, privateFile: false });
  requireThat(policy.default === 'allow' && Array.isArray(policy.deny) &&
    ['upload', 'download', 'waitfordownload'].every(action => policy.deny.includes(action)), 'CLIENT_POLICY_REQUIRED');
}
