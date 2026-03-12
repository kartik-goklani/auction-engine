import { IsEnum, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import { AuctionType } from '../../common/types';

/**
 * Input DTO for draftless price-intelligence analysis from the new-auction form.
 * Service layer uses this to validate the minimum context required for pricing.
 */
export class AnalyzePriceIntelligenceDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(2)
  category!: string;

  @IsPositive()
  quantity!: number;

  @IsString()
  @MinLength(1)
  unit!: string;

  @IsEnum(AuctionType)
  type!: AuctionType;

  @IsOptional()
  @IsString()
  description?: string;

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
}
