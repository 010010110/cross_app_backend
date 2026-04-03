import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, Length, Matches, MinLength } from 'class-validator';

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

  @ApiProperty({
    example: '+5543999998888',
    description: 'Telefone de contato do aluno (com DDI +55)',
  })
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'contactPhone deve conter entre 10 e 15 digitos e pode iniciar com +',
  })
  contactPhone: string;

  @ApiProperty({
    example: '+5543988887777',
    description: 'WhatsApp do aluno (com DDI +55)',
  })
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'whatsapp deve conter entre 10 e 15 digitos e pode iniciar com +',
  })
  whatsapp: string;

  @ApiProperty({
    example: 'Rua Pernambuco, 250 - Centro, Londrina/PR - 86020-120',
    description: 'Endereco completo em linha unica',
  })
  @IsString()
  @Length(10, 240)
  address: string;

  @ApiProperty({
    required: false,
    example: '@joaoatleta',
    description: 'Instagram do aluno',
  })
  @IsOptional()
  @Matches(/^@?[a-zA-Z0-9._]{2,30}$/, {
    message: 'socialInstagram deve ser um usuario valido do Instagram',
  })
  socialInstagram?: string;

  @ApiProperty({
    required: false,
    example: 'https://facebook.com/joao.aluno',
    description: 'Perfil do Facebook do aluno',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: true })
  socialFacebook?: string;
}
