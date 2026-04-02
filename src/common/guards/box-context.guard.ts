import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Injectable()
export class BoxContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const boxId = request.headers['x-box-id'];

    if (typeof boxId !== 'string' || !boxId) {
      throw new ForbiddenException('Header x-box-id ausente');
    }

    if (!request.user.boxIds.includes(boxId)) {
      throw new ForbiddenException('Box nao pertence ao usuario');
    }

    request.user = { ...request.user, boxId };

    return true;
  }
}
