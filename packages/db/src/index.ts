export { prisma, connectDb, disconnectDb } from './client.js';

export { Platform, OAuthProvider, Prisma } from '@prisma/client';

export type {
  User,
  Guild,
  TwitchChannel,
  Command,
  LiveAlert,
  OAuthToken,
  BotCredential,
  CommandLog,
} from '@prisma/client';
