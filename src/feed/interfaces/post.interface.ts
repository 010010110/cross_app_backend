import { ObjectId } from 'mongodb';
import { FeedPostSource } from '../../common/enums';

export interface Post {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  checkinId?: ObjectId;
  text: string;
  photoUrl?: string;
  source?: FeedPostSource;
  resultId?: ObjectId;
  createdAt: Date;
}
