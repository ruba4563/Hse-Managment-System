import {
  IsUUID,
} from 'class-validator';

export class AssignSiteUserDto {
  @IsUUID('4')
  userId!: string;
}