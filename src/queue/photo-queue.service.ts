import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';

type PhotoProcessingJobPayload = {
  photoId: string;
  roomId: string;
  storageKey: string;
};

@Injectable()
export class PhotoQueueService implements OnModuleDestroy {
  private readonly queue?: Queue;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      const parsed = new URL(redisUrl);
      const tlsEnabled = parsed.protocol === 'rediss:';

      this.queue = new Queue('photo-processing', {
        connection: {
          host: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : 6379,
          username: parsed.username || undefined,
          password: parsed.password || undefined,
          tls: tlsEnabled ? {} : undefined,
          maxRetriesPerRequest: null,
          // Required for Upstash serverless — don't buffer commands when offline
          enableOfflineQueue: false,
          connectTimeout: 10_000,
        },
      });
    }
  }

  async enqueuePhotoProcessing(payload: PhotoProcessingJobPayload): Promise<string | null> {
    if (!this.queue) {
      return null;
    }

    const jobId = `photo:${payload.photoId}:process`;
    const options: JobsOptions = {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    };

    await this.queue.add('process-photo', payload, options);
    return jobId;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
