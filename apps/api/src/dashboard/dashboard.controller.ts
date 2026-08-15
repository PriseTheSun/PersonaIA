import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DashboardQuery, dashboardQuerySchema } from './dashboard.schemas';
import { DashboardService } from './dashboard.service';

@Roles('SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(
    @CurrentUser() actor: Principal,
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery
  ) {
    return this.dashboard.summary(actor, query);
  }
}
