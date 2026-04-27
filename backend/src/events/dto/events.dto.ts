import { IsString, IsOptional } from 'class-validator';

export class JoinRoomDto {
  @IsString() room: string; // companyId o userId
}

export class EmitEventDto {
  @IsString() event: string;
  @IsOptional() data?: any;
}

export class SendToUserDto {
  @IsString() userId: string;
  @IsString() event: string;
  @IsOptional() data?: any;
}