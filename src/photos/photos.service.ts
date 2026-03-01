import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { PhotoQueueService } from '../queue/photo-queue.service';
import { RoomsService } from '../rooms/rooms.service';
import type { StorageService } from '../storage/storage.types';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

const SUPPORTED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/heic'];

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly photoQueueService: PhotoQueueService,
    @Inject('StorageService') private readonly storageService: StorageService,
  ) {}

  async createUploadUrl(roomId: string, dto: CreateUploadUrlDto) {
    await this.roomsService.ensureUploadAllowed(roomId);

    if (!SUPPORTED_CONTENT_TYPES.includes(dto.contentType.toLowerCase())) {
      throw new BadRequestException('Unsupported file type. Allowed: jpeg, png, heic');
    }

    return this.storageService.generateUploadUrl({
      roomId,
      fileName: dto.fileName,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
    });
  }

  async completeUpload(roomId: string, dto: CompleteUploadDto) {
    const room = await this.roomsService.ensureUploadAllowed(roomId);

    if (!dto.key.startsWith(`rooms/${roomId}/`)) {
      throw new BadRequestException('Invalid key for this room');
    }

    await this.storageService.assertObjectExists(dto.bucket, dto.key);

    // Resolve uploader session if guestToken provided
    let uploaderSessionId: string | null = null;
    if (dto.guestToken) {
      const session = await this.prisma.guestSession.findUnique({
        where: { guestToken: dto.guestToken },
        select: { id: true, roomId: true, status: true },
      });

      if (!session || session.roomId !== roomId) {
        throw new BadRequestException('Invalid guest token for this room');
      }

      if (session.status === 'BLOCKED') {
        throw new BadRequestException('Guest session is blocked');
      }

      uploaderSessionId = session.id;
    }

    const status =
      room.uploadPermission === 'APPROVAL_REQUIRED' ? 'PENDING_APPROVAL' : 'PROCESSING';

    const photo = await this.prisma.photo.create({
      data: {
        id: randomUUID(),
        roomId,
        uploaderSessionId,
        storageKey: dto.key,
        bucket: dto.bucket,
        originalFileName: dto.originalFileName?.trim() || null,
        contentType: dto.contentType,
        sizeBytes: BigInt(dto.sizeBytes),
        status,
      },
    });

    if (status === 'PROCESSING') {
      const jobId = await this.photoQueueService.enqueuePhotoProcessing({
        photoId: photo.id,
        roomId: photo.roomId,
        storageKey: photo.storageKey,
      });

      if (jobId) {
        await this.prisma.photo.update({
          where: { id: photo.id },
          data: { processingJobId: jobId },
        });
      }
    }

    return { ...photo, sizeBytes: Number(photo.sizeBytes) };
  }

  async listByRoom(roomId: string) {
    const roomExists = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });

    if (!roomExists) {
      throw new NotFoundException('Room not found');
    }

    const photos = await this.prisma.photo.findMany({
      where: { roomId, status: { not: 'DELETED' } },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        roomId: true,
        storageKey: true,
        contentType: true,
        sizeBytes: true,
        status: true,
        thumbnailKey: true,
        previewKey: true,
        uploadedAt: true,
        originalFileName: true,
        source: true,
      },
    });

    return Promise.all(
      photos.map(async (p) => ({
        ...p,
        sizeBytes: Number(p.sizeBytes),
        thumbnailUrl: p.thumbnailKey
          ? await this.storageService.generateReadUrl(p.thumbnailKey)
          : null,
      })),
    );
  }
}
