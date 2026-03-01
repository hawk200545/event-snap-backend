import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;
}
