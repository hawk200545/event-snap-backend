import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { GenerateUploadUrlInput, GenerateUploadUrlOutput, StorageService } from './storage.types';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly expiresInSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') ?? 'us-east-1';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') ?? 'eventsnap-dev';
    this.expiresInSeconds = Number(
      this.configService.get<string>('AWS_S3_UPLOAD_EXPIRES_SECONDS') ?? '900',
    );

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
      // Disable automatic checksums — presigned URL clients can't compute them
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async generateUploadUrl(input: GenerateUploadUrlInput): Promise<GenerateUploadUrlOutput> {
    const sanitizedFileName = input.fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-');

    const key = `rooms/${input.roomId}/original/${Date.now()}-${randomUUID()}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.expiresInSeconds,
    });

    return { bucket: this.bucket, key, uploadUrl, expiresInSeconds: this.expiresInSeconds };
  }

  async assertObjectExists(bucket: string, key: string): Promise<void> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      throw new InternalServerErrorException('Uploaded file not found in storage');
    }
  }

  async generateReadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
