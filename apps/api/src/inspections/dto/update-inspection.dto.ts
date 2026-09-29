import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// Project, site, type and inspector are fixed after checklist creation.
export class UpdateInspectionDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true })
  scheduledAt?: string;
}
