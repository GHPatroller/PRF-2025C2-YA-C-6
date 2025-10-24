export async function sendPrivateChat(clientRef, userId, message) {
  const id = Number(userId);
  if (!id || !message) return;

  const client = clientRef?.current;
  try {
    // Component View (EmbeddedClient)
    if (client?.sendChat) {
      await client.sendChat(message, id);
      return;
    }
    // Client View (ZoomMtg)
    if (window.ZoomMtg?.sendChat) {
      window.ZoomMtg.sendChat({
        message,
        userId: id,
        success: () => console.log('DM enviado a', id),
        error: (err) => console.error('DM (ZoomMtg) falló', err),
      });
      return;
    }
    console.warn('No encontré API de chat disponible en este modo de SDK.');
  } catch (e) {
    console.error('Error enviando DM', e);
  }
}
