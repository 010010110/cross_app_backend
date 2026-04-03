import { ObjectId } from 'mongodb';
import { ResultScoreKind } from '../../common/enums';

export { ResultScoreKind };

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
