import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { InspectionCategory } from '../../generated/prisma/client.js';

export class CreateInspectionTypeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,49}$/)
  code: string;

  @IsEnum(InspectionCategory)
  category: InspectionCategory;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  description?: string;
}
