import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateVendorProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  contactName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryTags?: string[];
}
