import { ObjectId } from 'mongodb';

export type RewardXpLedgerType = 'CHECKIN_DAILY' | 'STREAK_MILESTONE' | 'FREEZE_CONSUMED';

export interface RewardXpLedger {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  type: RewardXpLedgerType;
  points: number;
  createdAt: Date;
  metadata?: {
    streakDays?: number;
    rewardFreeze?: number;
  };
}
