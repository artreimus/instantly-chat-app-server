import { Prisma } from '@prisma/client';
import { ApolloError } from 'apollo-server-core';
import { GraphQLContext } from '../../util/types';

const resolvers = {
  //   Query: {},
  Mutation: {
    createConversation: async (
      _: any,
      args: { participantIds: Array<string> },
      context: GraphQLContext
    ) => {
      const { session, prisma } = context;
      const { participantIds } = args;

      if (!session?.user) throw new ApolloError('Not authorized');

      const {
        user: { id: userId },
      } = session;

      try {
        const conversation = await prisma.conversation.create({
          data: {
            participants: {
              createMany: {
                data: participantIds.map((id) => ({
                  userId: id,
                  hasSeenLatestMessage: id === userId,
                })),
              },
            },
          },
          // return data
          include: conversationPopulated,
        });
      } catch (error) {
        console.error('createConversation', error);
        throw new ApolloError('Error creating conversation');
      }
    },
  },
};

// return data
export const participantPopulated =
  Prisma.validator<Prisma.ConversationParticipantInclude>()({
    user: {
      select: {
        id: true,
        username: true,
      },
    },
  });

export const conversationPopulated =
  Prisma.validator<Prisma.ConversationInclude>()({
    participants: {
      // select properties from User model
      include: participantPopulated,
    },
    latestMessage: {
      include: {
        // select properties from User model
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    },
  });

export default resolvers;
