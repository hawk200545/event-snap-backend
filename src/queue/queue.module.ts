import { Module } from '@nestjs/common';
import { PhotoQueueService } from './photo-queue.service';

@Module({
  providers: [PhotoQueueService],
  exports: [PhotoQueueService],
})
export class QueueModule {}
