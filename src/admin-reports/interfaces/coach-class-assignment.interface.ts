import { ObjectId } from 'mongodb';

export interface CoachClassAssignment {
  _id?: ObjectId;
  boxId: ObjectId;
  coachId: ObjectId;
  classId: ObjectId;
  active: boolean;
  assignedAt: Date;
  unassignedAt?: Date;
  createdBy: ObjectId;
}
