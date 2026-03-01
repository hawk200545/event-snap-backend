import { IsNumber, IsPositive, IsString, Max } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  fileName: string;

  @IsString()
  contentType: string;

  @IsNumber()
  @IsPositive()
  @Max(25 * 1024 * 1024)
  sizeBytes: number;
}
