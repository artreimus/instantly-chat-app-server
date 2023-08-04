import { ISODateString } from 'next-auth';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  conversationPopulated,
  participantPopulated,
} from '../graphql/resolvers/conversation';
import { Context } from 'graphql-ws/lib/server';
import { PubSub } from 'graphql-subscriptions';

// Server configuration
export interface GraphQLContext {
  session: Session | null;
  prisma: PrismaClient;
  pubsub: PubSub;
}

export interface Session {
  user?: User;
  expires: ISODateString;
}

export interface SubscriptionContext extends Context {
  connectionParams: {
    session?: Session;
  };
}

// User types:

export interface User {
  id: string;
  username: string;
  image: string;
}

export interface CreateUsernameResponse {
  success?: boolean;
  error?: string;
}

// Conversation types:
export type ConversationPopulated = Prisma.ConversationGetPayload<{
  include: typeof conversationPopulated;
}>;

export type ParticipantPopulated = Prisma.ConversationParticipantGetPayload<{
  include: typeof participantPopulated;
}>;
