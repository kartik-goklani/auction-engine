import { IsInt, IsPositive } from 'class-validator';

export class CreateBidDto {
  @IsInt()
  @IsPositive()
  amount!: number;
}
