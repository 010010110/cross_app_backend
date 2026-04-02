import { UserRole } from '../types/user-role.type';

export interface JwtPayload {
  sub: string;
  email: string;
  boxIds: string[];
  boxId?: string;
  role: UserRole;
}
