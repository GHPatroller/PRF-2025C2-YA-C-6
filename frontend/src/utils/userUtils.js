export const isBool = (v) => typeof v === 'boolean';

// hay que ajustar la condicion si es host o asistente
export const shouldManageUser = (u) => !!u && !u.isHost;

/** Normaliza cualquier payload/ítem a array */
export function toArray(x) {
  if (Array.isArray(x)) return x;
  if (!x) return [];
  // algunos SDKs envían users, user o detail.user
  if (x.users) return Array.isArray(x.users) ? x.users : [x.users];
  if (x.user) return [x.user];
  if (x.detail?.user) return [x.detail.user];
  return [x];
}

/**
 * Busca el usuario real en el roster a partir de distintos shapes/ids del payload.
 * Firma compatible con tu uso: findUserFromPayload(roster, item)
 */
export function findUserFromPayload(roster = [], item = {}) {
  const uid =
    item.userId ??
    item.id ??
    item.uid ??
    item.participantId ??
    item.userGuid ??
    item.userGUID;

  const byGuid =
    item.userGuid ??
    item.userGUID ??
    item?.user?.userGuid ??
    item?.user?.userGUID ??
    item?.detail?.user?.userGuid ??
    item?.detail?.user?.userGUID;

  // 1) match por userId
  if (uid) {
    const hit = roster.find(u => u.userId === uid || u.id === uid || u.participantId === uid);
    if (hit) return hit;
  }

  // 2) match por guid
  if (byGuid) {
    const hit = roster.find(u => u.userGuid === byGuid || u.userGUID === byGuid);
    if (hit) return hit;
  }

  // 3) si vino anidado en user/detail.user
  const nested = item.user || item.detail?.user;
  if (nested?.userId) {
    const hit = roster.find(u => u.userId === nested.userId);
    if (hit) return hit;
  }

  // 4) último recurso: devolvés el item crudo
  return item;
}
