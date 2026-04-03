import { ObjectId } from 'mongodb';

export interface Checkin {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  classId: ObjectId;
  latitude: number;
  longitude: number;
  distanceFromBoxInMeters: number;
  createdAt: Date;
}
