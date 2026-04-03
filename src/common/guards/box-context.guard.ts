import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { BoxesService } from '../../boxes/boxes.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Injectable()
export class BoxContextGuard implements CanActivate {
  constructor(@Inject(BoxesService) private readonly boxesService: BoxesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const boxId = request.headers['x-box-id'];

    if (typeof boxId !== 'string' || !boxId) {
      throw new ForbiddenException('Header x-box-id ausente');
    }

    const userId = request.user.sub;
    await this.boxesService.validateUserBoxMembership(userId, boxId);

    request.user = { ...request.user, boxId };

    return true;
  }
}
