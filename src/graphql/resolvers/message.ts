import { GraphQLError } from 'graphql';
import { GraphQLContext, SendMessageArguments } from '../../util/types';
import { Prisma } from '@prisma/client';
import {
  MessageSentSubscriptionPayload,
  MessagePopulated,
} from '../../util/types';
import { withFilter } from 'graphql-subscriptions';
import { userIsConversationParticipant } from '../../util/functions';
import { conversationPopulated } from './conversation';

const resolvers = {
  Query: {
    messages: async (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ): Promise<Array<MessagePopulated>> => {
      const { session, prisma } = context;
      const { conversationId } = args;

      if (!session?.user) {
        throw new GraphQLError('Not authorized');
      }

      const {
        user: { id: userId },
      } = session;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: conversationPopulated,
      });

      if (!conversation) throw new GraphQLError('Conversation not found');

      const allowedToView = userIsConversationParticipant(
        conversation.participants,
        userId
      );

      if (!allowedToView) throw new GraphQLError('Not authorized');

      try {
        const messages = await prisma.message.findMany({
          where: { conversationId },
          include: messagePopulated,
          orderBy: { createdAt: 'desc' },
        });

        return messages;
      } catch (error: any) {
        console.log('messages error', error);
        throw new GraphQLError(error?.message);
      }
    },
  },
  Mutation: {
    sendMessage: async (
      _: any,
      args: SendMessageArguments,
      context: GraphQLContext
    ): Promise<boolean> => {
      const { session, prisma, pubsub } = context;

      if (!session?.user) throw new GraphQLError('Not Authorized');

      const { id: userId } = session.user;
      const { id: messageId, senderId, conversationId, body } = args;

      // if (userId !== senderId) throw new GraphQLError('Not Authorized');

      try {
        // Create new message
        const newMessage = await prisma.message.create({
          data: { id: messageId, senderId, conversationId, body },
          include: messagePopulated,
        });

        // Find ConversationParticipant entity
        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            userId,
            conversationId,
          },
        });

        if (!participant) throw new GraphQLError('Participant not found');

        const { id: participantId } = participant;

        // Update conversation entity
        const conversation = await prisma.conversation.update({
          where: {
            id: conversationId,
          },
          data: {
            latestMessageId: newMessage.id,
            participants: {
              update: {
                where: {
                  id: participantId,
                },
                data: {
                  hasSeenLatestMessage: true,
                },
              },
              updateMany: {
                where: {
                  userId: {
                    not: userId,
                  },
                },
                data: {
                  hasSeenLatestMessage: false,
                },
              },
            },
          },
          include: conversationPopulated,
        });

        // this will call messageSent subscription
        pubsub.publish(
          'MESSAGE_SENT',
          // payload
          { messageSent: newMessage }
        );

        // this will call conversationUpdated subscription
        pubsub.publish('CONVERSATION_UPDATED', {
          // payload
          conversationUpdated: { conversation },
        });
      } catch (error: any) {
        console.log('sendMessageError', error.message);
        throw new GraphQLError('Error sending emssage');
      }

      return true;
    },
  },
  Subscription: {
    messageSent: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;
          // pass in the events we want to listen to
          return pubsub.asyncIterator(['MESSAGE_SENT']);
        },
        (
          payload: MessageSentSubscriptionPayload,
          args: { conversationId: string },
          context: GraphQLContext
        ) => {
          // data with payload's schema will be returned by the resolver
          return payload.messageSent.conversationId === args.conversationId;
        }
      ),
    },
  },
};

export const messagePopulated = Prisma.validator<Prisma.MessageInclude>()({
  sender: {
    select: {
      id: true,
      username: true,
    },
  },
});

export default resolvers;
