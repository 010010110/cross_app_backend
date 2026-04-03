import { ObjectId } from 'mongodb';
import { UserRole } from '../types/user-role.type';

export interface User {
  _id?: ObjectId;
  boxIds: ObjectId[];
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  contactPhone?: string;
  whatsapp?: string;
  address?: string;
  socialInstagram?: string;
  socialFacebook?: string;
  createdAt: Date;
}
