import {
    ChannelProfileType,
    ClientRoleType,
    createAgoraRtcEngine,
    IRtcEngine,
} from 'react-native-agora';

import { AGORA_APP_ID } from './agora';

let engine: IRtcEngine | null = null;

export const initAgora = async () => {
  if (engine) return engine;

  engine = createAgoraRtcEngine();

  engine.initialize({
    appId: AGORA_APP_ID,
    channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
  });

  engine.enableAudio();

  return engine;
};

export const joinVoiceChannel = async (channelName: string) => {
  const agoraEngine = await initAgora();

  agoraEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

  agoraEngine.joinChannel(
    '',
    channelName,
    0,
    {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    }
  );

  return agoraEngine;
};

export const muteLocalAudio = async (muted: boolean) => {
  if (!engine) return;

  engine.muteLocalAudioStream(muted);
};

export const leaveVoiceChannel = async () => {
  if (!engine) return;

  engine.leaveChannel();
  engine.release();
  engine = null;
};