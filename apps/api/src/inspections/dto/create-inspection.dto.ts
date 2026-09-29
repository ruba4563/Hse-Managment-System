import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateInspectionDto {
  @IsUUID('4')
  inspectionTypeId: string;

  @IsUUID('4')
  projectId: string;

  @IsUUID('4')
  siteId: string;

  @IsUUID('4')
  inspectorId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  title: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true })
  scheduledAt?: string;
}
