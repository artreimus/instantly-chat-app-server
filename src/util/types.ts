import { ISODateString, Session } from 'next-auth';
import { PrismaClient } from '@prisma/client';

export interface GraphQLContext {
  session: Session | null;
  prisma: PrismaClient;
  // pubsub
}

// User types:

// export interface Session {
//   user?: User;
//   expires: ISODateString;
// }

// export interface User {
//   id: string;
//   username: string;
//   image: string;
// }

export interface CreateUsernameResponse {
  success?: boolean;
  error?: string;
}
