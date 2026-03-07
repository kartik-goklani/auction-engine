import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { AuctionType, AuctionVisibility } from '../../common/types';

export class CreateAuctionDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(2)
  category!: string;

  @IsEnum(AuctionType)
  type!: AuctionType;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @IsInt()
  @IsPositive()
  ceilingPrice!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  reservePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDecrement?: number;

  @IsOptional()
  @IsBoolean()
  autoExtendEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  autoExtendMinutes?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  autoExtendTrigger?: number;

  @IsOptional()
  @IsEnum(AuctionVisibility)
  visibility?: AuctionVisibility;
}
