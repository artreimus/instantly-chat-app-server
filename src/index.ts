import { ApolloServer } from 'apollo-server-express';
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault,
} from 'apollo-server-core';
import { makeExecutableSchema } from '@graphql-tools/schema';
import express from 'express';
import http from 'http';
import typeDefs from './graphql/typeDefs';
import resolvers from './graphql/resolvers';
import * as dotenv from 'dotenv';
import { getSession } from 'next-auth/react';
import { GraphQLContext } from './util/types';
import { PrismaClient } from '@prisma/client';

async function main() {
  dotenv.config();
  const app = express();
  const httpServer = http.createServer(app);
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const corsOption = { origin: process.env.CLIENT_ORIGIN, credentials: true };

  // Context parameters
  const prisma = new PrismaClient();
  // const pubsub

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: 'bounded',
    // context is similar to a middleware
    context: async ({ req, res }): Promise<GraphQLContext> => {
      const session = await getSession({ req });
      return { session, prisma };
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });
  await server.start();
  server.applyMiddleware({ app, cors: corsOption });
  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4000 }, resolve)
  );
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
}

main().catch((err) => console.log(err));
