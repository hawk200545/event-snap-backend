import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { PhotosService } from './photos.service';

@Controller('rooms/:roomId/photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post('upload-url')
  createUploadUrl(
    @Param('roomId') roomId: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.photosService.createUploadUrl(roomId, dto);
  }

  @Post('complete')
  completeUpload(@Param('roomId') roomId: string, @Body() dto: CompleteUploadDto) {
    return this.photosService.completeUpload(roomId, dto);
  }

  @Get()
  listByRoom(@Param('roomId') roomId: string) {
    return this.photosService.listByRoom(roomId);
  }
}
