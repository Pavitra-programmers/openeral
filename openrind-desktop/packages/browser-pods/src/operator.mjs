import { requireThat } from './contracts.mjs';

// Offline operation: PodRegistry's exclusive lock keeps a live broker out.
// An empty inventory cannot prove that an earlier create will never arrive.
export async function resolveAbsent(registry, runtime, id, { confirmNoPendingCreate, reason }) {
  requireThat(confirmNoPendingCreate === true, 'OPERATOR_CONFIRMATION_REQUIRED');
  requireThat(typeof reason === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(reason), 'REASON_CODE_REQUIRED');
  const session = registry.get(id);
  requireThat(session && session.accessRevokedAt !== null && session.resourceDeletedAt === null &&
    !session.handle?.id && session.cleanupError === 'CREATE_OUTCOME_UNKNOWN', 'NOT_UNCERTAIN_CREATE');
  requireThat(!await runtime.inventory(session), 'RESOURCE_STILL_PRESENT');
  registry.transaction(() => {
    session.browserStoppedAt = Date.now(); session.resourceDeletedAt = Date.now();
    session.state = 'Stopped'; session.attachment = null; session.operatorResolution = reason;
    registry.put(session); registry.audit('operator-resolved-absent', id, reason);
  });
}
