import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'Joao Aluno', description: 'Nome do aluno' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'joao@aluno.com', description: 'Email do aluno' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Aluno@123', description: 'Senha do aluno' })
  @IsString()
  @MinLength(8)
  password: string;
}
