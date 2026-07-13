export async function getAgoraToken(channelName: string) {
  const response = await fetch(
    'https://kdjartbuhxrkbwunqatc.supabase.co/functions/v1/agora-token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: 'sb_publishable_RA40gdUUf8ONNUZZtJY8MA_r2lnEvW3',
      },
      body: JSON.stringify({
        channelName,
      }),
    }
  );

  if (!response.ok) {
    throw new Error('No se pudo obtener token Agora');
  }

  return response.json();
}