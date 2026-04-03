import { ObjectId } from 'mongodb';
import { WodBlockType } from '../../common/enums';

export { WodBlockType };

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
  blocks: WodBlock[];
  createdAt: Date;
}