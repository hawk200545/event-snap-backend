import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FacesService } from './faces.service';

@Controller('rooms/:roomId/faces')
export class FacesController {
  constructor(private readonly facesService: FacesService) {}

  @Get()
  listFaces(@Param('roomId') roomId: string) {
    return this.facesService.listFaces(roomId);
  }

  @Get(':faceId/photos')
  getPhotosByFace(
    @Param('roomId') roomId: string,
    @Param('faceId') faceId: string,
  ) {
    return this.facesService.getPhotosByFace(roomId, faceId);
  }

  @Post('selfie-match')
  @UseInterceptors(FileInterceptor('selfie', { limits: { fileSize: 10 * 1024 * 1024 } }))
  selfieMatch(
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.facesService.selfieMatch(roomId, file);
  }
}
