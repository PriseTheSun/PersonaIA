import type { MembershipStatus } from '@/lib/schemas';

export function isPendingAccess(status: MembershipStatus) {
  return status === 'PENDING' || status === 'PENDING_APPROVAL' || status === 'INVITED';
}
