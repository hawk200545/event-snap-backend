import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CompleteUploadDto {
  @IsString()
  bucket: string;

  @IsString()
  key: string;

  @IsString()
  contentType: string;

  @IsNumber()
  @IsPositive()
  sizeBytes: number;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  @IsOptional()
  @IsString()
  guestToken?: string;
}
