import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { Checkin } from '../checkins/interfaces/checkin.interface';
import { CreateFeedPostDto } from './dto/create-feed-post.dto';
import { Post } from './interfaces/post.interface';

export type AutoPrPostStatus = 'created' | 'skipped-no-checkin' | 'skipped-already-posted';

export interface AutoPrPostResult {
  status: AutoPrPostStatus;
  postId?: ObjectId;
  checkinId?: ObjectId;
}

@Injectable()
export class FeedService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

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
      source: 'MANUAL',
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
      return { status: 'skipped-no-checkin' };
    }

    const existingPostForCheckin = await this.db.collection<Post>('posts').findOne({
      checkinId: latestCheckin._id,
    });

    if (existingPostForCheckin) {
      return {
        status: 'skipped-already-posted',
        checkinId: latestCheckin._id,
      };
    }

    const post: Post = {
      userId: normalizedUserId,
      boxId: normalizedBoxId,
      checkinId: latestCheckin._id,
      text: params.text,
      source: 'PR_AUTO',
      resultId: params.resultId,
      createdAt: new Date(),
    };

    const insertPostResult = await this.db.collection<Post>('posts').insertOne(post);

    return {
      status: 'created',
      postId: insertPostResult.insertedId,
      checkinId: latestCheckin._id,
    };
  }
}
