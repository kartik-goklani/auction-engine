import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PauseAuctionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
