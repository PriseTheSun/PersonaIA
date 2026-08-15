import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AccessControlService } from '../common/access-control.service';

@Global()
@Module({ providers: [PrismaService, AccessControlService], exports: [PrismaService, AccessControlService] })
export class PrismaModule {}
