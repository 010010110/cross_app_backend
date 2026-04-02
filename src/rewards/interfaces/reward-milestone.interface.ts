import { ObjectId } from 'mongodb';

export interface RewardMilestone {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  streakDays: number;
  rewardXp: number;
  rewardFreeze: number;
  unlockedAt: Date;
}
