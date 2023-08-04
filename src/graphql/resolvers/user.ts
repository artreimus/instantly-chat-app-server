import { GraphQLError } from 'graphql';
import { CreateUsernameResponse, GraphQLContext } from '../../util/types';

const resolvers = {
  Query: {
    searchUsers: async (
      _: any,
      args: { username: string },
      context: GraphQLContext
    ) => {
      const { username: searchedUsername } = args;
      const { session, prisma } = context;

      if (!session?.user) {
        // Frontend catches the error
        throw new GraphQLError('Not authorized');
      }

      const {
        user: { username: myUsername },
      } = session;

      try {
        // Find users in db excluding self. Not case sensitive
        const users = await prisma.user.findMany({
          where: {
            username: {
              contains: searchedUsername,
              not: myUsername,
              mode: 'insensitive',
            },
          },
        });

        return users;
      } catch (error: any) {
        console.error('searchedUsers', error);
        throw new GraphQLError(error?.message);
      }
    },
  },
  Mutation: {
    // _ argument is not needed
    createUsername: async (
      _: any,
      args: { username: string },
      context: GraphQLContext
    ): Promise<CreateUsernameResponse> => {
      const { username } = args;
      const { session, prisma } = context;

      if (!session?.user) {
        return {
          error: 'Not authorized',
        };
      }

      const { id: userId } = session.user;

      try {
        // Check if username is unique
        const existingUser = await prisma.user.findUnique({
          where: {
            username,
          },
        });

        if (existingUser) {
          return {
            error: 'Username already taken. Please try another',
          };
        }

        // Update user
        await prisma.user.update({
          where: { id: userId },
          data: { username },
        });

        return { success: true };
      } catch (error) {
        console.error('createUsername', error);
        let message = '';
        if (error instanceof Error) message = error?.message;
        return {
          error: message,
        };
      }
    },
  },
};

export default resolvers;
