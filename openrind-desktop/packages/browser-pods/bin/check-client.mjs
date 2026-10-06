import { validateClientProfile } from '../src/client-profile.mjs';

try { await validateClientProfile(); }
catch (error) {
  process.stderr.write(`browser-pods: ${error.code || 'CLIENT_PROFILE_INVALID'}\n`);
  process.exitCode = 1;
}
