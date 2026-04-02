import { ObjectId } from 'mongodb';

export type ResultScoreKind = 'TIME' | 'LOAD' | 'UNKNOWN';

export interface Result {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  wodId?: ObjectId;
  exerciseId: ObjectId;
  score: string;
  scoreKind: ResultScoreKind;
  isNewPR: boolean;
  createdAt: Date;
}
