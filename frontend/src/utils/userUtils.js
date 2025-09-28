export const toArray = (x) => (Array.isArray(x) ? x : [x].filter(Boolean));
export const isBool = (v) => typeof v === 'boolean';

export const findUserFromPayload = (roster, payload) => {
  return roster.find(
    (u) =>
      u.userId === payload?.userId ||
      u.userID === payload?.userID ||
      u.userGUID === payload?.userGUID ||
      u.userGuid === payload?.userGuid
  );
};

export const shouldManageUser = (user) => {
  return user && user.userId && !user.isHost && !user.isCohost;
};

