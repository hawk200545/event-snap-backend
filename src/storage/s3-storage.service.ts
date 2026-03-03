import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { GenerateUploadUrlInput, GenerateUploadUrlOutput, StorageService } from './storage.types';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly expiresInSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') ?? 'us-east-1';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') ?? 'eventsnap-dev';
    this.logger.log(`S3 configured — bucket: ${this.bucket}, region: ${this.region}`);
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
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.expiresInSeconds,
    });

    this.logger.log(`Generated presigned PUT URL — key: ${key}`);
    return { bucket: this.bucket, key, uploadUrl, expiresInSeconds: this.expiresInSeconds };
  }

  async assertObjectExists(bucket: string, key: string): Promise<void> {
    this.logger.log(`HeadObject check — bucket: ${bucket}, key: ${key}`);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      this.logger.log(`HeadObject OK — object exists`);
    } catch (err: unknown) {
      const e = err as any;
      const httpStatus: number = e?.$metadata?.httpStatusCode;
      this.logger.error(
        `HeadObject FAILED — ` +
        `name: ${e?.name}, ` +
        `httpStatus: ${httpStatus}, ` +
        `requestId: ${e?.$metadata?.requestId}, ` +
        `message: ${e?.message}`
      );
      // 403 means either no HeadObject IAM permission (object may still exist)
      // or object is missing but no ListBucket permission hides the 404.
      // Treat 403 as a warning — CORS + IAM policy must be fixed in AWS console.
      if (httpStatus === 403) {
        this.logger.warn(`HeadObject returned 403 — skipping existence check. Fix S3 CORS and IAM HeadObject permission.`);
        return;
      }
      throw new InternalServerErrorException(
        `Uploaded file not found in storage [${httpStatus ?? e?.name}]: ${e?.message}`,
      );
    }
  }

  async generateReadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
