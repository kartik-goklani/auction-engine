import { IsInt, Min } from 'class-validator';

export class ExtendAuctionDto {
  @IsInt()
  @Min(1)
  minutes!: number;
}
