import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterUserDto {
  @ApiProperty({ example: 'Joao Aluno', description: 'Nome do usuario' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'joao@aluno.com', description: 'Email do usuario' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Aluno@123', description: 'Senha do usuario' })
  @IsString()
  @MinLength(8)
  password: string;
}
