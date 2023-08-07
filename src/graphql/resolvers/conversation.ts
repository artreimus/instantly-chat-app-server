import { Prisma } from '@prisma/client';
import { GraphQLError } from 'graphql';
import {
  ConversationCreatedSubscriptionPayload,
  ConversationDeletedSubscriptionPayload,
  // ConversationDeletedSubscriptionPayload,
  ConversationPopulated,
  ConversationUpdatedSubscriptionPayload,
  GraphQLContext,
} from '../../util/types';
import { withFilter } from 'graphql-subscriptions';
import { userIsConversationParticipant } from '../../util/functions';
// import { cascadeDelete } from 'prisma-cascade-delete';
// import {} from 'prisma-cascade-delete';

const resolvers = {
  Query: {
    conversations: async (
      _: any,
      __: any,
      context: GraphQLContext
    ): Promise<Array<ConversationPopulated>> => {
      const { session, prisma } = context;

      if (!session.user) throw new GraphQLError('Not authorized');

      try {
        const {
          user: { id: userId },
        } = session;
        /**
         * Find all conversations that user is part of
         */
        const conversations = await prisma.conversation.findMany({
          /**
           * Below has been confirmed to be the correct
           * query by the Prisma team. Has been confirmed
           * that there is an issue on their end
           * Issue seems specific to Mongo
           */
          // where: {
          //   participants: {
          //     some: {
          //       userId: {
          //         equals: id,
          //       },
          //     },
          //   },
          // },
          include: conversationPopulated,
        });

        /**
         * Since above query does not work
         */
        return conversations.filter(
          (conversation) =>
            !!conversation.participants.find((p) => p.userId === userId)
        );
      } catch (error: any) {
        console.log('conversations error');
        throw new GraphQLError(error?.message);
      }
    },
  },
  Mutation: {
    createConversation: async (
      _: any,
      args: { participantIds: Array<string> },
      context: GraphQLContext
    ) => {
      const { session, prisma, pubsub } = context;
      const { participantIds } = args;
      if (!session?.user) throw new GraphQLError('Not authorized');

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

        pubsub.publish('CONVERSATION_CREATED', {
          conversationCreated: conversation,
        });

        return { conversationId: conversation.id };
      } catch (error) {
        console.error('createConversation', error);
        throw new GraphQLError('Error creating conversation');
      }
    },
    markConversationAsRead: async (
      _: any,
      args: { userId: string; conversationId: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      const { session, prisma } = context;
      const { userId, conversationId } = args;

      if (!session?.user) throw new GraphQLError('Not authorized');

      try {
        const participant = await prisma.conversationParticipant.findFirst({
          where: { userId, conversationId },
        });

        if (!participant) throw new GraphQLError('Participant Not Found');

        await prisma.conversationParticipant.update({
          where: { id: participant.id },
          data: { hasSeenLatestMessage: true },
        });

        return true;
      } catch (error: any) {
        console.log('markedConversationAsRead error', error);
        throw new GraphQLError(error?.message);
      }
    },
    deleteConversation: async function (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ): Promise<boolean> {
      const { session, prisma, pubsub } = context;
      const { conversationId } = args;

      if (!session?.user) {
        throw new GraphQLError('Not authorized');
      }

      try {
        /**
         * Delete conversation and all related entities
         */
        const [deletedConversation] = await prisma.$transaction([
          prisma.conversation.delete({
            where: {
              id: conversationId,
            },
            include: conversationPopulated,
          }),
          prisma.conversationParticipant.deleteMany({
            where: {
              conversationId,
            },
          }),
          prisma.message.deleteMany({
            where: {
              conversationId,
            },
          }),
        ]);

        pubsub.publish('CONVERSATION_DELETED', {
          conversationDeleted: deletedConversation,
        });

        return true;
      } catch (error: any) {
        console.log('deleteConversation error', error);
        throw new GraphQLError(error?.message);
      }
    },
  },
  Subscription: {
    conversationCreated: {
      // subscribe: (_: any, __: any, context: GraphQLContext) => {
      // const { pubsub } = context;
      // console.log('Subscription hit');
      // return pubsub.asyncIterator(['CONVERSATION_CREATED']);
      // },
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;
          // pass in the events we want to listen to
          return pubsub.asyncIterator(['CONVERSATION_CREATED']);
        },
        (
          payload: ConversationCreatedSubscriptionPayload,
          _,
          context: GraphQLContext
        ) => {
          const { session } = context;
          const {
            conversationCreated: { participants },
          } = payload;

          if (!session?.user) throw new GraphQLError('Not authorized');

          return userIsConversationParticipant(participants, session.user.id);
        }
      ),
    },
    conversationUpdated: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;
          // pass in the events we want to listen to
          return pubsub.asyncIterator(['CONVERSATION_UPDATED']);
        },
        (
          payload: ConversationUpdatedSubscriptionPayload,
          _,
          context: GraphQLContext
        ) => {
          console.log('Here is payload', payload);
          const { session } = context;
          const {
            conversationUpdated: {
              conversation: { participants },
            },
          } = payload;

          if (!session?.user) throw new GraphQLError('Not authorized');

          const {
            user: { id },
          } = session;

          return userIsConversationParticipant(participants, id);
        }
      ),
    },
    conversationDeleted: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;
          // pass in the events we want to listen to
          return pubsub.asyncIterator(['CONVERSATION_UPDATED']);
        },
        (
          payload: ConversationDeletedSubscriptionPayload,
          _: any,
          context: GraphQLContext
        ) => {
          const { session } = context;

          if (!session?.user) throw new GraphQLError('Not authorized');
          const { id: userId } = session.user;
          const {
            conversationDeleted: {
              conversation: { participants },
            },
          } = payload;

          return userIsConversationParticipant(participants, userId);
        }
      ),
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
