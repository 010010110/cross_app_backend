import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class UseEnrollmentTokenDto {
  @ApiProperty({
    example: '482901',
    description: 'Token numerico de 6 digitos gerado pelo aluno para matricula no box',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'token deve conter exatamente 6 digitos numericos',
  })
  token!: string;
}
