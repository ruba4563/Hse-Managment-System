import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}