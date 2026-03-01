import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { RoomsModule } from '../rooms/rooms.module';
import { StorageModule } from '../storage/storage.module';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [RoomsModule, StorageModule, QueueModule],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
