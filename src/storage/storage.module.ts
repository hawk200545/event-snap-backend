import { Module } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service';

@Module({
  providers: [
    {
      provide: 'StorageService',
      useClass: S3StorageService,
    },
  ],
  exports: ['StorageService'],
})
export class StorageModule {}
