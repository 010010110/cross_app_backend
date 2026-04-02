import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { RegisterBoxDto } from './dto/register-box.dto';
import { BoxesService } from './boxes.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Boxes')
@Controller('boxes')
export class BoxesController {
  constructor(private readonly boxesService: BoxesService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Cadastro do contratante',
    description:
      'Cria um novo Box (ou filial via parentBoxId), cria ou vincula o ADMIN informado e ja retorna o JWT da sessao autenticada para o novo box.',
  })
  @ApiResponse({ status: 201, description: 'Box cadastrado com sucesso e JWT retornado automaticamente' })
  @ApiResponse({ status: 400, description: 'Dados invalidos ou duplicados' })
  async register(@Body() registerBoxDto: RegisterBoxDto) {
    return this.boxesService.register(registerBoxDto);
  }

  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lista os boxes do usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de boxes retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Token ausente, invalido ou expirado' })
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.boxesService.findMineByUserId(request.user.sub);
  }
}
