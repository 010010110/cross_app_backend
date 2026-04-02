import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterBoxDto {
  @ApiProperty({
    required: false,
    example: '67ea76a5ac5d89c8bb9d2111',
    description: 'ID do box matriz para cadastro de filial',
  })
  @IsOptional()
  @IsMongoId()
  parentBoxId?: string;

  @ApiProperty({ example: 'Cross Box Alpha', description: 'Nome do box' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: '12345678000199', description: 'CNPJ do box' })
  @Matches(/^\d{14}$/, {
    message: 'cnpj deve conter 14 digitos numericos',
  })
  cnpj: string;

  @ApiProperty({ example: -23.56447, description: 'Latitude do box' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -46.65284, description: 'Longitude do box' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ example: 100, description: 'Raio de geofence em metros' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  geofenceRadius: number;

  @ApiProperty({ example: 'Ana Admin', description: 'Nome do administrador inicial' })
  @IsString()
  @Length(2, 120)
  adminName: string;

  @ApiProperty({ example: 'admin@box.com', description: 'Email do administrador inicial' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'Senha@123', description: 'Senha do administrador inicial' })
  @IsString()
  @MinLength(8)
  adminPassword: string;
}
