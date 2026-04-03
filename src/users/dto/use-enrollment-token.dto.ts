import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class UseEnrollmentTokenDto {
  @ApiProperty({
    example: '2a90e8f904194ea2c1435d85b8d628a2',
    description: 'Token temporario gerado pelo aluno para matricula no box',
  })
  @IsString()
  @Length(32, 32)
  @Matches(/^[a-f0-9]{32}$/i, {
    message: 'token deve ser um hexadecimal de 32 caracteres',
  })
  token: string;
}
