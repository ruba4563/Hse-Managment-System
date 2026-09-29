import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdatePermitChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  itemText?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}