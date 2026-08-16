import { Module } from '@nestjs/common';
import {
  DeferredInvitationEmailDelivery,
  INVITATION_EMAIL_DELIVERY,
} from './invitation-delivery';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    { provide: INVITATION_EMAIL_DELIVERY, useClass: DeferredInvitationEmailDelivery },
  ],
})
export class InvitationsModule {}
