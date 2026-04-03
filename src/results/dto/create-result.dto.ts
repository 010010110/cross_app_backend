import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateResultDto {
  @ApiProperty({
    description: 'ID do WOD executado',
    example: '67ea76a5ac5d89c8bb9d2111',
  })
  @IsMongoId()
  wodId: string;

  @ApiProperty({
    description:
      'Score final do WOD completo. AMRAP/EMOM/TABATA: repeticoes (ex: 120, 120 reps, 7+12). FOR_TIME/RFT/CHIPPER: tempo (ex: 02:34, 00:12:30). LADDER/INTERVALS: tempo ou repeticoes.',
    example: '120 reps',
  })
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  score: string;

  @ApiProperty({
    required: false,
    description: 'Texto customizado para auto-post no feed quando houver novo PR',
    example: 'Bati PR hoje no WOD! Muito feliz com a evolucao.',
  })
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsOptional()
  @IsString()
  @Length(2, 1200)
  autoPostText?: string;
}
