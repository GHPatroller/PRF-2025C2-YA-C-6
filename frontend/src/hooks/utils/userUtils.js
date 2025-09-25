// Helpers puros (sin estado, sin dependencias)
export const userUtils = {
  getRoster: (clientRef) => clientRef?.current?.getAttendeeslist?.() || [],
  
  toArray: (x) => (Array.isArray(x) ? x : [x].filter(Boolean)),
  
  isBool: (v) => typeof v === 'boolean',
  
  findUserFromPayload: (payload, clientRef) => {
    const roster = userUtils.getRoster(clientRef);
    return roster.find(
      (u) =>
        u.userId === payload?.userId ||
        u.userID === payload?.userID ||
        u.userGUID === payload?.userGUID ||
        u.userGuid === payload?.userGuid
    );
  },
  
  isRegularUser: (user) => user && !user.isHost && !user.isCohost
};