import { ObjectId } from 'mongodb';

export enum WodBlockType {
  WARMUP = 'WARMUP',
  SKILL = 'SKILL',
  WOD = 'WOD',
}

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