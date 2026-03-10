import { IsUUID } from 'class-validator';

export class AwardAuctionDto {
  @IsUUID()
  winningVendorId!: string;
}
