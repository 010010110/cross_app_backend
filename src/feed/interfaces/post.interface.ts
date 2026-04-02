import { ObjectId } from 'mongodb';

export interface Post {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  checkinId: ObjectId;
  text: string;
  photoUrl?: string;
  source?: 'MANUAL' | 'PR_AUTO';
  resultId?: ObjectId;
  createdAt: Date;
}
