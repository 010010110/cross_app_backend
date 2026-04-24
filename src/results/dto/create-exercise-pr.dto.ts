import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateExercisePrDto {
  @ApiProperty({
    description: 'ID do exercicio para registrar o PR',
    example: '67ea76a5ac5d89c8bb9d2122',
  })
  @IsMongoId()
  exerciseId: string;

  @ApiProperty({
    description:
      'Score do PR. Aceita carga (ex: 95, 95kg) ou tempo (ex: 02:34, 00:12:30).',
    example: '100kg',
  })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  score: string;

  @ApiProperty({
    required: false,
    description:
      'Texto customizado para auto-post no feed quando houver novo PR',
    example: 'PR no squat! Consistencia ta valendo a pena.',
  })
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsOptional()
  @IsString()
  @Length(2, 1200)
  autoPostText?: string;
}
