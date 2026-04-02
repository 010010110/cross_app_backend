import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login de usuario' })
  @ApiResponse({ status: 201, description: 'JWT de identidade retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais invalidas' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
