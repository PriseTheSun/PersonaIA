import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { PersonasController, ProjectAssetUsageController, QuestionnairesController } from './assets.controller';

@Module({ controllers: [PersonasController, QuestionnairesController, ProjectAssetUsageController], providers: [AssetsService] })
export class AssetsModule {}
