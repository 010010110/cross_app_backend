import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId, IsNumber, Max, Min } from 'class-validator';

export class CreateCheckinDto {
  @ApiProperty({
    description: 'ID da aula em que o aluno esta realizando check-in',
    example: '67ea76a5ac5d89c8bb9d3333',
  })
  @IsMongoId()
  classId!: string;

  @ApiProperty({
    description: 'Latitude atual do usuario',
    example: -23.56447,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude atual do usuario',
    example: -46.65284,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}
