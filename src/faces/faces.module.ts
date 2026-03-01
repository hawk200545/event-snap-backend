import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { FacesController } from './faces.controller';
import { FacesService } from './faces.service';

@Module({
  imports: [StorageModule],
  controllers: [FacesController],
  providers: [FacesService],
})
export class FacesModule {}
