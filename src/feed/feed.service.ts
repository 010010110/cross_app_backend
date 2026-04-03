import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { AutoPrPostStatus, FeedPostSource } from '../common/enums';
import { Checkin } from '../checkins/interfaces/checkin.interface';
import { CreateFeedPostDto } from './dto/create-feed-post.dto';
import { Post } from './interfaces/post.interface';

export { AutoPrPostStatus };

export interface AutoPrPostResult {
  status: AutoPrPostStatus;
  postId?: ObjectId;
  checkinId?: ObjectId;
}

@Injectable()
export class FeedService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

  async listFeedByUserBoxes(boxIds: string[], limit = 50) {
    const normalizedBoxIds = boxIds
      .filter((boxId) => ObjectId.isValid(boxId))
      .map((boxId) => new ObjectId(boxId));

    if (normalizedBoxIds.length === 0) {
      return [];
    }

    const normalizedLimit = Math.min(Math.max(limit, 1), 200);

    return this.db
      .collection<Post>('posts')
      .aggregate([
        {
          $match: {
            boxId: { $in: normalizedBoxIds },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: normalizedLimit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        {
          $lookup: {
            from: 'boxes',
            localField: 'boxId',
            foreignField: '_id',
            as: 'box',
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            boxId: 1,
            checkinId: 1,
            resultId: 1,
            text: 1,
            photoUrl: 1,
            source: 1,
            createdAt: 1,
            authorName: { $ifNull: [{ $arrayElemAt: ['$author.name', 0] }, null] },
            boxName: { $ifNull: [{ $arrayElemAt: ['$box.name', 0] }, null] },
          },
        },
      ])
      .toArray();
  }

  async createPost(userId: string, boxId: string, dto: CreateFeedPostDto) {
    const normalizedUserId = new ObjectId(userId);
    const normalizedBoxId = new ObjectId(boxId);
    const normalizedCheckinId = new ObjectId(dto.checkinId);

    const checkin = await this.db.collection<Checkin>('checkins').findOne({
      _id: normalizedCheckinId,
      userId: normalizedUserId,
      boxId: normalizedBoxId,
    });

    if (!checkin) {
      throw new BadRequestException('Check-in nao encontrado para este usuario no box atual');
    }

    const existingPostForCheckin = await this.db.collection<Post>('posts').findOne({
      checkinId: normalizedCheckinId,
    });

    if (existingPostForCheckin) {
      throw new ConflictException('Ja existe um post para este check-in');
    }

    const post: Post = {
      userId: normalizedUserId,
      boxId: normalizedBoxId,
      checkinId: normalizedCheckinId,
      text: dto.text,
      photoUrl: dto.photoUrl,
      source: FeedPostSource.MANUAL,
      createdAt: new Date(),
    };

    const result = await this.db.collection<Post>('posts').insertOne(post);

    return {
      postId: result.insertedId,
      checkinId: normalizedCheckinId,
      message: 'Post criado com sucesso',
    };
  }

  async createAutoPostForPr(params: {
    userId: string;
    boxId: string;
    resultId: ObjectId;
    text: string;
  }): Promise<AutoPrPostResult> {
    const normalizedUserId = new ObjectId(params.userId);
    const normalizedBoxId = new ObjectId(params.boxId);

    const latestCheckin = await this.db.collection<Checkin>('checkins').findOne(
      {
        userId: normalizedUserId,
        boxId: normalizedBoxId,
      },
      {
        sort: { createdAt: -1 },
      },
    );

    if (!latestCheckin?._id) {
      return { status: AutoPrPostStatus.SKIPPED_NO_CHECKIN };
    }

    const existingPostForCheckin = await this.db.collection<Post>('posts').findOne({
      checkinId: latestCheckin._id,
    });

    if (existingPostForCheckin) {
      return {
        status: AutoPrPostStatus.SKIPPED_ALREADY_POSTED,
        checkinId: latestCheckin._id,
      };
    }

    const post: Post = {
      userId: normalizedUserId,
      boxId: normalizedBoxId,
      checkinId: latestCheckin._id,
      text: params.text,
      source: FeedPostSource.PR_AUTO,
      resultId: params.resultId,
      createdAt: new Date(),
    };

    const insertPostResult = await this.db.collection<Post>('posts').insertOne(post);

    return {
      status: AutoPrPostStatus.CREATED,
      postId: insertPostResult.insertedId,
      checkinId: latestCheckin._id,
    };
  }
}
