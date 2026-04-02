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
        return client.db(mongoDbName);
      },
    },
  ],
  exports: [MONGO_CLIENT],
})
export class DatabaseModule {}
