import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Principal } from '../common/types/principal';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AssetQuery, assetQuerySchema, createAssetSchema, CreateAssetInput, updateAssetSchema, UpdateAssetInput } from './assets.schemas';
import { AssetsService } from './assets.service';

const authenticated = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER'] as const;

@Roles(...authenticated)
@Controller('tenants/:tenantId/personas')
export class PersonasController {
  constructor(private readonly assets: AssetsService) {}
  @Get() list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Query(new ZodValidationPipe(assetQuerySchema)) query: AssetQuery, @CurrentUser() actor: Principal) { return this.assets.list('PERSONA', tenantId, query, actor); }
  @Post() create(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body(new ZodValidationPipe(createAssetSchema)) input: CreateAssetInput, @CurrentUser() actor: Principal) { return this.assets.create('PERSONA', tenantId, input, actor); }
  @Get(':assetId') get(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() actor: Principal) { return this.assets.get('PERSONA', tenantId, assetId, actor); }
  @Patch(':assetId') update(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Body(new ZodValidationPipe(updateAssetSchema)) input: UpdateAssetInput, @CurrentUser() actor: Principal) { return this.assets.update('PERSONA', tenantId, assetId, input, actor); }
  @Delete(':assetId') remove(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() actor: Principal) { return this.assets.remove('PERSONA', tenantId, assetId, actor); }
  @Post(':assetId/workspaces/:workspaceId') associate(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() actor: Principal) { return this.assets.associate('PERSONA', tenantId, assetId, workspaceId, actor); }
  @Delete(':assetId/workspaces/:workspaceId') disassociate(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() actor: Principal) { return this.assets.disassociate('PERSONA', tenantId, assetId, workspaceId, actor); }
}

@Roles(...authenticated)
@Controller('tenants/:tenantId/questionnaires')
export class QuestionnairesController {
  constructor(private readonly assets: AssetsService) {}
  @Get() list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Query(new ZodValidationPipe(assetQuerySchema)) query: AssetQuery, @CurrentUser() actor: Principal) { return this.assets.list('QUESTIONNAIRE', tenantId, query, actor); }
  @Post() create(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Body(new ZodValidationPipe(createAssetSchema)) input: CreateAssetInput, @CurrentUser() actor: Principal) { return this.assets.create('QUESTIONNAIRE', tenantId, input, actor); }
  @Get(':assetId') get(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() actor: Principal) { return this.assets.get('QUESTIONNAIRE', tenantId, assetId, actor); }
  @Patch(':assetId') update(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Body(new ZodValidationPipe(updateAssetSchema)) input: UpdateAssetInput, @CurrentUser() actor: Principal) { return this.assets.update('QUESTIONNAIRE', tenantId, assetId, input, actor); }
  @Delete(':assetId') remove(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() actor: Principal) { return this.assets.remove('QUESTIONNAIRE', tenantId, assetId, actor); }
  @Post(':assetId/workspaces/:workspaceId') associate(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() actor: Principal) { return this.assets.associate('QUESTIONNAIRE', tenantId, assetId, workspaceId, actor); }
  @Delete(':assetId/workspaces/:workspaceId') disassociate(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Param('workspaceId', ParseUUIDPipe) workspaceId: string, @CurrentUser() actor: Principal) { return this.assets.disassociate('QUESTIONNAIRE', tenantId, assetId, workspaceId, actor); }
}

@Roles(...authenticated)
@Controller('projects/:projectId/assets')
export class ProjectAssetUsageController {
  constructor(private readonly assets: AssetsService) {}
  @Get('usage') list(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser() actor: Principal) { return this.assets.listUsage(projectId, actor); }
  @Post(':type/:assetId/usage') use(@Param('projectId', ParseUUIDPipe) projectId: string, @Param('type') type: string, @Param('assetId', ParseUUIDPipe) assetId: string, @CurrentUser() actor: Principal) { return this.assets.recordUsage(type, projectId, assetId, actor); }
}
