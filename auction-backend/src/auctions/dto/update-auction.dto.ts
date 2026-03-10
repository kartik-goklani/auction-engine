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
}
