import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import { MONGO_CLIENT } from './database.constants';

@Global()
@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<Db> => {
        const mongoUri = configService.get<string>('MONGO_URI', 'mongodb://localhost:27017');
        const mongoDbName = configService.get<string>('MONGO_DB_NAME', 'cross_app');

        const client = new MongoClient(mongoUri);
        await client.connect();
        const db = client.db(mongoDbName);

        // Create geospatial index for nearby boxes search
        await db.collection('boxes').createIndex({ 'location': '2dsphere' }).catch(() => {
          // Index might already exist, ignore error
        });

        // Enrollment token indexes (20s OTP-like flow + automatic expiration)
        await db
          .collection('enrollment_tokens')
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
          .catch(() => {
            // Index might already exist, ignore error
          });

        await db
          .collection('enrollment_tokens')
          .createIndex({ token: 1, usedAt: 1, expiresAt: 1 })
          .catch(() => {
            // Index might already exist, ignore error
          });

        return db;
      },
    },
  ],
  exports: [MONGO_CLIENT],
})
export class DatabaseModule {}
