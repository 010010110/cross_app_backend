import { ObjectId } from 'mongodb';
import { WodBlockType, WodModel } from '../../common/enums';

export { WodBlockType, WodModel };

export interface WodBlock {
  type: WodBlockType;
  title: string;
  content: string;
}

export interface Wod {
  _id?: ObjectId;
  boxId: ObjectId;
  date: Date;
  title: string;
  model?: WodModel;
  blocks: WodBlock[];
  createdAt: Date;
}