import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMilitaryTime,
  IsString,
  Length,
} from 'class-validator';
import { ClassWeekday } from '../../common/enums/class-weekday.enum';

export class CreateClassDto {
  @ApiProperty({
    example: 'Turma das 7h',
    description: 'Nome da aula',
  })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({
    description: 'Dias da semana em que a turma acontece',
    enum: ClassWeekday,
    isArray: true,
    example: [ClassWeekday.MONDAY, ClassWeekday.WEDNESDAY, ClassWeekday.FRIDAY],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ClassWeekday, { each: true })
  weekDays!: ClassWeekday[];

  @ApiProperty({
    example: '07:00',
    description: 'Horario de inicio da aula (HH:mm)',
  })
  @IsMilitaryTime()
  startTime!: string;

  @ApiProperty({
    example: '08:00',
    description: 'Horario de termino da aula (HH:mm)',
  })
  @IsMilitaryTime()
  endTime!: string;
}
