import { ObjectId } from 'mongodb';
import { RewardXpLedgerType } from '../../common/enums';

export { RewardXpLedgerType };

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
