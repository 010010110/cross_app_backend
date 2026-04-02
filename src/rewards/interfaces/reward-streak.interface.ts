import { ObjectId } from 'mongodb';

export interface RewardStreak {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  availableFreezes: number;
  totalXp: number;
  createdAt: Date;
  updatedAt: Date;
}
