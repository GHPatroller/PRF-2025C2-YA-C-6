import { zoomAPI } from "../services/zoomAPI";

export const useMeetingActions = (clientRef, callbacks) => {
  const { onUserAdmitted, onUserHeld, onMeetingCreated } = callbacks;

  const createAndJoinMeeting = async () => {
    const client = clientRef?.current;
    if (!client) return;

    try {
      const { meetingNumber, password } = await zoomAPI.createMeeting();
      const { signature } = await zoomAPI.getSignature(meetingNumber, 1);

      try {
        await client.leaveMeeting(true);
      } catch {}

      await client.join({
        signature,
        meetingNumber: String(meetingNumber),
        password: password || '',
        userName: 'Host PoC',
      });

      console.log('✅ Host unido');
      onMeetingCreated?.({ meetingNumber, password });
    } catch (err) {
      console.error('❌ Error create/join:', err);
      throw err;
    }
  };

  const admitUser = async (user) => {
    const client = clientRef?.current;
    if (!client || !user) return;

    const guidOrId = user.userGuid || user.userGUID || user.userId;
    if (!guidOrId) {
      console.log('❌ Falta userGuid/userId para admitir');
      return;
    }

    try {
      await client.admit(guidOrId);
      onUserAdmitted?.(user);
    } catch (err) {
      console.error('❌ Error admit:', err);
      throw err;
    }
  };

  const sendToWaitingRoom = async (user) => {
    if (!user?.userId) return;
    
    try {
      await clientRef.current.putOnHold(user.userId, true);
      onUserHeld?.(user);
    } catch (err) {
      console.error('❌ Error sending to waiting room:', err);
      throw err;
    }
  };

  return {
    createAndJoinMeeting,
    admitUser,
    sendToWaitingRoom
  };
};