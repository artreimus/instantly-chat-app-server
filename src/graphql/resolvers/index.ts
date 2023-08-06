import userResolvers from './user';
import merge from 'lodash.merge';
import conversationResolvers from './conversation';
import messageResolvers from './message';
import scalarResolvers from './scalars';

//  we use lodash.merge to efficiently merge the resolvers
const resolvers = merge(
  {},
  userResolvers,
  conversationResolvers,
  messageResolvers,
  scalarResolvers
);

export default resolvers;
