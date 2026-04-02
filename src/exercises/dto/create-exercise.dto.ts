import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { ExerciseCategory } from '../interfaces/exercise.interface';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Snatch', description: 'Nome do exercicio' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    example: ExerciseCategory.WEIGHTLIFTING,
    description: 'Categoria do exercicio',
    enum: ExerciseCategory,
  })
  @IsEnum(ExerciseCategory, {
    message: 'category deve ser WEIGHTLIFTING, GYMNASTICS, MONOSTRUCTURAL ou ACCESSORY',
  })
  category: string;
}
