import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@box.com', description: 'Email do usuario' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Senha@123', description: 'Senha do usuario' })
  @IsString()
  @MinLength(8)
  password: string;
}
