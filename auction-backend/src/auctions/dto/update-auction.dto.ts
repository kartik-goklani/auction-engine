import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuctionVisibility } from '../../common/types';

/** All fields are optional — only the provided ones are updated. */
export class UpdateAuctionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  category?: string;

  @IsOptional()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  ceilingPrice?: number;

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  keySpecs?: string;

  @IsOptional()
  @IsBoolean()
  trafficLightEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  trafficLightGreenPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(99)
  trafficLightYellowPct?: number;
}
