import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: { user: { sub: string } }) {
    return this.roomsService.listByOrganizer(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':roomId')
  getById(@Param('roomId') roomId: string) {
    return this.roomsService.getById(roomId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':roomId')
  delete(@Req() req: { user: { sub: string } }, @Param('roomId') roomId: string) {
    return this.roomsService.delete(roomId, req.user.sub);
  }

  // Public — no auth required for guests
  @Post(':code/join')
  join(@Param('code') code: string, @Body() dto: JoinRoomDto) {
    return this.roomsService.joinRoom(code, dto);
  }
}
