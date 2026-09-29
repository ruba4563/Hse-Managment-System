import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  InspectionFindingSeverity,
  InspectionFindingType,
} from '../../generated/prisma/client.js';

export class CreateInspectionFindingDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID('4')
  checklistResponseId?: string;

  @IsEnum(InspectionFindingType)
  findingType: InspectionFindingType;

  @IsEnum(InspectionFindingSeverity)
  severity: InspectionFindingSeverity;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  title: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  recommendedAction?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(500)
  location?: string;
}
