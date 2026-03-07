import { IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateLotDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsString()
  @MinLength(1)
  unit!: string;

  @IsOptional()
  @IsString()
  specifications?: string;
}
