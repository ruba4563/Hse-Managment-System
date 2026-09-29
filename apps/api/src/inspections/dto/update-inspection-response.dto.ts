import { IsEnum, IsString, MaxLength, ValidateIf } from 'class-validator';
import { InspectionResponseResult } from '../../generated/prisma/client.js';

export class UpdateInspectionResponseDto {
  @IsEnum(InspectionResponseResult)
  result: InspectionResponseResult;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  comments?: string;
}
