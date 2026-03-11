import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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

  @IsEnum(AuctionType)
  type!: AuctionType;

  @IsOptional()
  @IsString()
  description?: string;
}
