import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApprovePermitDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}