export const INVITATION_EMAIL_DELIVERY = Symbol('INVITATION_EMAIL_DELIVERY');

export type InvitationEmailPayload = {
  recipient: string;
  tenantName: string;
  role: 'CLIENT_ADMIN' | 'CLIENT_MEMBER';
  projectName?: string;
  token: string;
  expiresAt: Date;
};

export interface InvitationEmailDelivery {
  deliver(payload: InvitationEmailPayload): Promise<boolean>;
}

export class DeferredInvitationEmailDelivery implements InvitationEmailDelivery {
  async deliver(_payload: InvitationEmailPayload) {
    return Promise.resolve(false);
  }
}
