import { IsString, MinLength, IsOptional } from 'class-validator';

// `email` se usa como IDENTIFICADOR: puede ser un correo O un usuario simple (ej. "cajera1").
// Por eso ya NO se valida con @IsEmail. `username` es un alias alternativo.
export class LoginDto {
  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
