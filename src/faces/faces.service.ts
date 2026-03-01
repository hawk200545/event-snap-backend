import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import type { StorageService } from '../storage/storage.types';

const SIMILARITY_THRESHOLD = 0.6;

@Injectable()
export class FacesService {
  private readonly pythonWorkerUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject('StorageService') private readonly storageService: StorageService,
  ) {
    this.pythonWorkerUrl = this.configService.get<string>('PYTHON_WORKER_URL') ?? '';
  }

  async listFaces(roomId: string) {
    await this.assertRoomExists(roomId);

    const faces = await this.prisma.faceEmbedding.findMany({
      where: { roomId, faceThumbKey: { not: null } },
      select: {
        id: true,
        photoId: true,
        faceIndex: true,
        faceThumbKey: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      faces.map(async (f) => ({
        ...f,
        faceThumbUrl: await this.storageService.generateReadUrl(f.faceThumbKey!),
      })),
    );
  }

  async getPhotosByFace(roomId: string, faceId: string) {
    await this.assertRoomExists(roomId);

    const target = await this.prisma.faceEmbedding.findFirst({
      where: { id: faceId, roomId },
    });

    if (!target) throw new NotFoundException('Face not found');

    return this.searchByEmbedding(roomId, target.embedding, faceId);
  }

  async selfieMatch(roomId: string, file: Express.Multer.File) {
    await this.assertRoomExists(roomId);

    if (!this.pythonWorkerUrl) {
      throw new ServiceUnavailableException('AI service not configured');
    }

    if (!['image/jpeg', 'image/png', 'image/heic'].includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    // Send selfie to Python service for embedding extraction
    const form = new FormData();
    form.append('image', new Blob([file.buffer.buffer as ArrayBuffer], { type: file.mimetype }), file.originalname);

    let embedding: number[];
    try {
      const res = await fetch(`${this.pythonWorkerUrl}/extract-embedding`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        throw new BadRequestException(err?.detail ?? 'Failed to extract face embedding');
      }

      const data = await res.json() as { embedding: number[] };
      embedding = data.embedding;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new ServiceUnavailableException('AI service unreachable');
    }

    return this.searchByEmbedding(roomId, embedding);
  }

  private async searchByEmbedding(roomId: string, embedding: number[], excludeFaceId?: string) {
    const allEmbeddings = await this.prisma.faceEmbedding.findMany({
      where: {
        roomId,
        ...(excludeFaceId ? { id: { not: excludeFaceId } } : {}),
      },
      select: { photoId: true, embedding: true },
    });

    const matchedPhotoIds = new Set<string>();

    for (const e of allEmbeddings) {
      const sim = this.cosineSimilarity(embedding, e.embedding);
      if (sim >= SIMILARITY_THRESHOLD) {
        matchedPhotoIds.add(e.photoId);
      }
    }

    if (matchedPhotoIds.size === 0) return [];

    const photos = await this.prisma.photo.findMany({
      where: { id: { in: [...matchedPhotoIds] }, status: 'READY' },
      select: {
        id: true,
        storageKey: true,
        thumbnailKey: true,
        contentType: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return Promise.all(
      photos.map(async (p) => ({
        ...p,
        thumbnailUrl: p.thumbnailKey
          ? await this.storageService.generateReadUrl(p.thumbnailKey)
          : null,
      })),
    );
  }

  private async assertRoomExists(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });
    if (!room) throw new NotFoundException('Room not found');
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
