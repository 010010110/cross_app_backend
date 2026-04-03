import { ObjectId } from 'mongodb';
import { ResultScoreKind, WodModel } from '../../common/enums';

export { ResultScoreKind };

export interface Result {
  _id?: ObjectId;
  userId: ObjectId;
  boxId: ObjectId;
  wodId?: ObjectId;
  exerciseId?: ObjectId;
  wodModel?: WodModel;
  wodTitle?: string;
  score: string;
  scoreKind: ResultScoreKind;
  isNewPR?: boolean;
  createdAt: Date;
}
