import { zoomAPI } from "../services/zoomAPI";

export const useMeetingActions = (clientRef, callbacks) => {
  const { onUserAdmitted, onUserHeld, onMeetingCreated } = callbacks;

  const createAndJoinMeeting = async () => {
    const client = clientRef?.current;
    if (!client) {
      console.error('❌ Zoom client not initialized');
      return;
    }

    const meetingData = zoomAPI.getMeetingData();

    if (!meetingData) {
      console.error('❌ No meeting data received from Moodle iframe');
      alert('Error: No se recibieron los datos de la reunión. Por favor, recarga la página.');
      return;
    }

    if (!zoomAPI.isReady()) {
      console.error('❌ Meeting data incomplete:', meetingData);
      alert('Error: Datos de reunión incompletos. Por favor, recarga la página.');
      return;
    }

    try {
      try {
        console.log('🚪 Attempting to leave any existing meeting...');
        await client.leaveMeeting(true);
        console.log('✅ Left previous meeting');
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (leaveError) {
        console.log('ℹ️ No previous meeting to leave or already left:', leaveError.message);
      }

      console.log('🔗 Joining meeting with data from Moodle:', {
        meetingNumber: meetingData.meetingNumber,
        role: meetingData.role,
        hasSignature: !!meetingData.signature,
        userName: meetingData.user?.fullname,
        userObject: meetingData.user
      });

      const finalUserName = meetingData.user?.fullname || meetingData.user?.username || 'Usuario Moodle';
      console.log('👤 Final userName to use:', finalUserName);

      await client.join({
        signature: meetingData.signature,
        sdkKey: meetingData.sdkKey,
        meetingNumber: String(meetingData.meetingNumber),
        password: meetingData.password || '',
        userName: finalUserName,
      });

      console.log('✅ Successfully joined meeting');
      onMeetingCreated?.({
        meetingNumber: meetingData.meetingNumber,
        password: meetingData.password
      });
    } catch (err) {
      console.error('❌ Error joining meeting:', err);
      alert('Error al unirse a la reunión: ' + (err.message || err.reason || 'Error desconocido'));
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