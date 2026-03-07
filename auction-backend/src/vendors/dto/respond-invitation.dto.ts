import { IsEnum } from 'class-validator';
import { InvitationStatus } from '../../common/types';

export class RespondInvitationDto {
  @IsEnum([InvitationStatus.ACCEPTED, InvitationStatus.DECLINED])
  status!: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED;
}
