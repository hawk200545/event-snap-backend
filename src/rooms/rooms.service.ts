import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { toDataURL } from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizerId: string, dto: CreateRoomDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const code = await this.generateUniqueCode();

    const room = await this.prisma.room.create({
      data: {
        code,
        organizerId,
        name: dto.name.trim(),
        startsAt,
        endsAt,
        uploadPermission: dto.uploadPermission ?? 'PUBLIC',
        faceRecognitionEnabled: dto.faceRecognitionEnabled ?? true,
        retentionDays: dto.retentionDays ?? 7,
        status: startsAt <= new Date() ? 'ACTIVE' : 'DRAFT',
      },
    });

    const joinUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/rooms/${room.code}/join`;
    const qrCodeDataUrl = await toDataURL(joinUrl);

    return { ...room, qrCodeDataUrl };
  }

  async listByOrganizer(organizerId: string) {
    return this.prisma.room.findMany({
      where: { organizerId, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.withComputedStatus(room);
  }

  async getByCode(code: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.withComputedStatus(room);
  }

  async joinRoom(code: string, dto: JoinRoomDto) {
    const room = await this.getByCode(code);

    if (room.status === 'DELETED' || room.status === 'EXPIRED') {
      throw new BadRequestException('This room is no longer active');
    }

    const guestToken = uuidv4();

    const session = await this.prisma.guestSession.create({
      data: {
        roomId: room.id,
        guestToken,
        displayName: dto.displayName?.trim() || null,
      },
    });

    return {
      guestToken: session.guestToken,
      sessionId: session.id,
      room: {
        id: room.id,
        name: room.name,
        code: room.code,
        status: room.status,
        endsAt: room.endsAt,
        uploadPermission: room.uploadPermission,
        faceRecognitionEnabled: room.faceRecognitionEnabled,
      },
    };
  }

  async delete(roomId: string, organizerId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, organizerId: true, status: true },
    });

    if (!room) throw new NotFoundException('Room not found');
    if (room.organizerId !== organizerId) throw new ForbiddenException('Not your room');
    if (room.status === 'DELETED') throw new NotFoundException('Room not found');

    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'DELETED' },
    });

    return { success: true };
  }

  async ensureUploadAllowed(roomId: string) {
    const room = await this.getById(roomId);

    if (room.status === 'DELETED' || room.status === 'EXPIRED') {
      throw new BadRequestException('Room is not accepting uploads');
    }

    const now = new Date();
    if (now < room.startsAt || now > room.endsAt) {
      throw new BadRequestException('Uploads are only allowed during the active event window');
    }

    return room;
  }

  private async withComputedStatus<T extends { status: string; endsAt: Date; startsAt: Date; id: string }>(
    room: T,
  ): Promise<T> {
    if (room.status === 'DELETED') return room;

    const now = new Date();
    const nextStatus = now > room.endsAt ? 'EXPIRED' : now >= room.startsAt ? 'ACTIVE' : 'DRAFT';

    if (nextStatus !== room.status) {
      await this.prisma.room.update({
        where: { id: room.id },
        data: { status: nextStatus as any },
      });
      return { ...room, status: nextStatus };
    }

    return room;
  }

  private async generateUniqueCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const existing = await this.prisma.room.findUnique({ where: { code }, select: { id: true } });
      if (!existing) return code;
    }
    throw new Error('Failed to generate a unique room code');
  }
}
