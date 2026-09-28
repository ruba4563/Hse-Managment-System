import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsUUID('4')
  employeeId!: string;

  @IsUUID('4')
  roleId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'username may contain letters, numbers, dots, underscores, and hyphens only',
  })
  username!: string;

 @IsEmail()
@MaxLength(254)
email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}