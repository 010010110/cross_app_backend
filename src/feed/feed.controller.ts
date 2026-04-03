import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateFeedPostDto } from './dto/create-feed-post.dto';
import { FeedService } from './feed.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

const uploadDirectory = join(process.cwd(), 'uploads', 'feed');

const multerStorage = diskStorage({
  destination: (_req, _file, callback) => {
    if (!existsSync(uploadDirectory)) {
      mkdirSync(uploadDirectory, { recursive: true });
    }

    callback(null, uploadDirectory);
  },
  filename: (_req, file, callback) => {
    const fileExtension = extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${uniqueSuffix}${fileExtension}`);
  },
});

const imageFileFilter = (
  _req: Request,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.startsWith('image/')) {
    callback(new BadRequestException('Apenas arquivos de imagem sao permitidos'), false);
    return;
  }

  callback(null, true);
};

@ApiTags('Feed')
@ApiBearerAuth()
@ApiHeader({ name: 'x-box-id', description: 'ID do box selecionado', required: true })
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ALUNO)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: multerStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload de imagem para post do feed' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['image'],
    },
  })
  @ApiResponse({ status: 201, description: 'Upload realizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Imagem invalida ou ausente' })
  async uploadImage(
    @Req() request: { protocol: string; get(name: string): string | undefined },
    @UploadedFile() file?: { filename: string },
  ) {
    if (!file) {
      throw new BadRequestException('Imagem nao enviada');
    }

    const publicUrl = `${request.protocol}://${request.get('host')}/uploads/feed/${file.filename}`;

    return {
      url: publicUrl,
      filename: file.filename,
      message: 'Upload realizado com sucesso',
    };
  }

  @Post('post')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ALUNO)
  @ApiOperation({
    summary: 'Cria post no feed do box',
    description:
      'Recebe texto + foto opcional e vincula o post a um check-in valido do aluno. Um check-in aceita somente um post.',
  })
  @ApiResponse({ status: 201, description: 'Post criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados invalidos ou check-in nao encontrado' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para postar' })
  @ApiResponse({ status: 409, description: 'Ja existe post para o check-in informado' })
  async createPost(@Req() request: AuthenticatedRequest, @Body() createFeedPostDto: CreateFeedPostDto) {
    return this.feedService.createPost(request.user.sub, request.user.boxId!, createFeedPostDto);
  }
}
