import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { WodBlockType, WodModel } from '../interfaces/wod.interface';

export class CreateWodBlockDto {
  @ApiProperty({
    example: WodBlockType.WARMUP,
    description: 'Tipo do bloco do treino',
    enum: WodBlockType,
  })
  @IsEnum(WodBlockType)
  type: WodBlockType;

  @ApiProperty({ example: 'Warm-up geral', description: 'Titulo do bloco' })
  @IsString()
  @Length(2, 120)
  title: string;

  @ApiProperty({
    example: '3 rounds: 20 air squats, 10 inchworms, 200m run',
    description: 'Conteudo/descricao do bloco',
  })
  @IsString()
  @Length(2, 2000)
  content: string;
}

export class CreateWodDto {
  @ApiProperty({
    example: '2026-03-31',
    description: 'Data do treino no formato ISO',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 'WOD de Terça',
    description: 'Titulo principal do treino',
  })
  @IsString()
  @Length(2, 120)
  title: string;

  @ApiProperty({
    required: false,
    example: WodModel.AMRAP,
    description:
      'Modelo do treino. Se omitido, o backend tenta inferir automaticamente a partir do titulo/conteudo.',
    enum: WodModel,
  })
  @IsOptional()
  @IsEnum(WodModel)
  model?: WodModel;

  @ApiProperty({
    description: 'Lista ordenada de blocos do treino',
    type: [CreateWodBlockDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWodBlockDto)
  blocks: CreateWodBlockDto[];
}
