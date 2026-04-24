import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class CreateFeedPostDto {
  @ApiProperty({
    required: false,
    description: 'ID do check-in usado para validar que o aluno fez a aula',
    example: '67ea76a5ac5d89c8bb9d2111',
  })
  @IsOptional()
  @IsMongoId()
  checkinId?: string;

  @ApiProperty({
    description: 'Texto do post',
    example: 'Aula de hoje foi insana. Novo PR no deadlift!',
  })
  @IsString()
  @Length(2, 1200)
  text: string;

  @ApiProperty({
    required: false,
    description: 'URL publica da imagem enviada via /feed/upload',
    example: 'http://localhost:3000/uploads/feed/1712086421000-123456789.jpg',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  photoUrl?: string;
}
