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

// How similar two faces must be to count as the same person in search results
const SEARCH_DISTANCE_THRESHOLD = 0.40;   // cosine distance ≤ 0.40 → similarity ≥ 0.60
// How similar two faces must be to collapse them into one in the faces list
const DEDUP_DISTANCE_THRESHOLD = 0.50;    // looser — same person at different angles/lighting

type PhotoRow = {
  id: string;
  storageKey: string;
  thumbnailKey: string | null;
  contentType: string;
  uploadedAt: Date;
};

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

    // Return one representative face per unique person.
    // A face is kept only if no earlier face (smaller id) in the same room
    // is within the cosine distance threshold — i.e. it's a new unique person.
    type FaceRow = { id: string; photoId: string; faceIndex: number; faceThumbKey: string; createdAt: Date };
    const faces = await this.prisma.$queryRawUnsafe<FaceRow[]>(
      `SELECT fe.id, fe."photoId", fe."faceIndex", fe."faceThumbKey", fe."createdAt"
       FROM "FaceEmbedding" fe
       WHERE fe."roomId" = $1
         AND fe."faceThumbKey" IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM "FaceEmbedding" fe2
           WHERE fe2."roomId" = $1
             AND fe2."faceThumbKey" IS NOT NULL
             AND fe2.id < fe.id
             AND (fe2.embedding <=> fe.embedding) <= $2
         )
       ORDER BY fe."createdAt" ASC`,
      roomId,
      DEDUP_DISTANCE_THRESHOLD,
    );

    return Promise.all(
      faces.map(async (f) => ({
        ...f,
        faceThumbUrl: await this.storageService.generateReadUrl(f.faceThumbKey),
      })),
    );
  }

  async getPhotosByFace(roomId: string, faceId: string) {
    await this.assertRoomExists(roomId);

    // Fetch the target face's embedding via raw SQL (Unsupported field)
    const rows = await this.prisma.$queryRawUnsafe<{ embedding: string }[]>(
      `SELECT embedding::text AS embedding FROM "FaceEmbedding" WHERE id = $1 AND "roomId" = $2`,
      faceId,
      roomId,
    );

    if (!rows.length) throw new NotFoundException('Face not found');

    return this.searchByVector(roomId, rows[0].embedding);
  }

  async selfieMatch(roomId: string, file: Express.Multer.File) {
    await this.assertRoomExists(roomId);

    if (!this.pythonWorkerUrl) {
      throw new ServiceUnavailableException('AI service not configured');
    }

    if (!['image/jpeg', 'image/png', 'image/heic'].includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

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

    // Convert number[] → pgvector literal "[x,x,x,...]"
    const vec = `[${embedding.join(',')}]`;
    return this.searchByVector(roomId, vec);
  }

  // ── pgvector cosine search ────────────────────────────────────────────────

  private async searchByVector(roomId: string, vec: string) {
    const photos = await this.prisma.$queryRawUnsafe<PhotoRow[]>(
      `SELECT DISTINCT p.id, p."storageKey", p."thumbnailKey", p."contentType", p."uploadedAt"
       FROM "FaceEmbedding" fe
       JOIN "Photo" p ON p.id = fe."photoId"
       WHERE fe."roomId" = $1
         AND p.status = 'READY'
         AND (fe.embedding <=> $2::vector) <= $3
       ORDER BY p."uploadedAt" DESC`,
      roomId,
      vec,
      SEARCH_DISTANCE_THRESHOLD,
    );

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
}
