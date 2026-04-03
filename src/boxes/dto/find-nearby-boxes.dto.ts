import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class FindNearbyBoxesDto {
  @ApiProperty({ example: -23.56447, description: 'Latitude atual do usuario' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -46.65284, description: 'Longitude atual do usuario' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    example: 5000,
    description: 'Raio de busca em metros (padrao: 5000, maximo: 50000)',
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(50000)
  radius?: number;
}
