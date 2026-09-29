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
// UPDATE PERMIT DTO
// =====================================================

export class UpdatePermitDto {
  @IsOptional()
  @IsUUID()
  permitTypeId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  // ===================================================
  // LOCATION
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
  // PPE
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

  @IsOptional()
  @IsISO8601()
  startDateTime?: string;

  @IsOptional()
  @IsISO8601()
  endDateTime?: string;

  // ===================================================
  // DESCRIPTION
  // ===================================================

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description?: string;
}