import { ObjectId } from 'mongodb';

export interface EnrollmentToken {
  _id?: ObjectId;
  userId: ObjectId;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  usedByBoxId?: ObjectId;
  createdAt: Date;
}
