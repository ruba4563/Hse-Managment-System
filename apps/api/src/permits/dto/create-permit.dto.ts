import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// =====================================================
// CREATE PERMIT DTO
// =====================================================

export class CreatePermitDto {
  @IsUUID()
  permitTypeId!: string;

  @IsUUID()
  projectId!: string;

  @IsUUID()
  siteId!: string;

  // ===================================================
  // WORK LOCATION
  // ===================================================

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  // ===================================================
  // CONTRACTOR / DEPARTMENT
  // ===================================================

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contractorDepartment?: string;

  // ===================================================
  // REQUIRED PPE
  // ===================================================

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({
    each: true,
  })
  requiredPpe?: string[];

  // ===================================================
  // HAZARDS
  // ===================================================

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({
    each: true,
  })
  hazards?: string[];

  // ===================================================
  // CONTROL MEASURES
  // ===================================================

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({
    each: true,
  })
  controlMeasures?: string[];

  // ===================================================
  // DATES
  // ===================================================

  @IsISO8601()
  startDateTime!: string;

  @IsISO8601()
  endDateTime!: string;

  // ===================================================
  // DESCRIPTION
  // ===================================================

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description!: string;
}