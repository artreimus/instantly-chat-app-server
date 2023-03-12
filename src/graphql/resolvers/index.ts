import userResolvers from './user';
import merge from 'lodash.merge';
import conversationResolvers from './conversation';

//  we use lodash.merge to efficiently merge the resolvers
const resolvers = merge({}, userResolvers, conversationResolvers);

export default resolvers;
