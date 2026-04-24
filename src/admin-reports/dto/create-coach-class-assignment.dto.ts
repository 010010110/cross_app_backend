import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreateCoachClassAssignmentDto {
  @ApiProperty({
    example: '67ebfa12ac5d89c8bb9d2103',
    description: 'ID do coach vinculado',
  })
  @IsMongoId({ message: 'coachId deve ser um ObjectId valido' })
  coachId!: string;

  @ApiProperty({
    example: '67ebb001ac5d89c8bb9d2201',
    description: 'ID da aula vinculada ao coach',
  })
  @IsMongoId({ message: 'classId deve ser um ObjectId valido' })
  classId!: string;
}
