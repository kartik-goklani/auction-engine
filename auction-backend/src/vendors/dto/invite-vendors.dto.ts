import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class InviteVendorsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  vendorIds!: string[];
}
