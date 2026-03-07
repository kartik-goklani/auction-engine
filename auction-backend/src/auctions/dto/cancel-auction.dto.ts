import { IsString, MinLength } from 'class-validator';

export class CancelAuctionDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
