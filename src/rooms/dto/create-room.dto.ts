import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum UploadPermission {
  PUBLIC = 'PUBLIC',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
}

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsEnum(UploadPermission)
  uploadPermission?: UploadPermission;

  @IsOptional()
  @IsBoolean()
  faceRecognitionEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  retentionDays?: number;
}
