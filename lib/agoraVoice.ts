import { PermissionsAndroid, Platform } from 'react-native';
import {
  AudioProfileType,
  AudioScenarioType,
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  IRtcEngine,
} from 'react-native-agora';
import { getAgoraToken } from './getAgoraToken';

type InitAgoraVoiceParams = {
  channelName: string;
  onJoined?: () => void;
  onUserJoined?: (uid: number) => void;
  onUserOffline?: (uid: number) => void;
  onError?: (message: string) => void;
};

let engine: IRtcEngine | null = null;
let joinedChannel = false;

async function requestAndroidAudioPermission() {
  if (Platform.OS !== 'android') return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function initAgoraVoice({
  channelName,
  onJoined,
  onUserJoined,
  onUserOffline,
  onError,
}: InitAgoraVoiceParams) {
  try {
    console.log('========== INIT AGORA ==========');
    console.log('CHANNEL:', channelName);
    console.log('PLATFORM:', Platform.OS);

    const granted = await requestAndroidAudioPermission();
    console.log('AUDIO PERMISSION:', granted);

    if (!granted) {
      throw new Error('Permiso de micrófono denegado');
    }

    console.log('Pidiendo token Agora...');
    const agoraData = await getAgoraToken(channelName);

    console.log('TOKEN RECIBIDO:', !!agoraData.token);
    console.log('AGORA_APP_ID:', agoraData.appId);
    console.log('AGORA_UID:', agoraData.uid);

    if (!engine) {
      engine = createAgoraRtcEngine();

      engine.registerEventHandler({
        onJoinChannelSuccess: (_connection, elapsed) => {
          console.log('✅ AGORA JOIN OK');
          console.log('JOIN ELAPSED:', elapsed);
          joinedChannel = true;
          onJoined?.();
        },

        onUserJoined: (_connection, remoteUid, elapsed) => {
          console.log('👤 AGORA USER JOINED:', remoteUid, 'elapsed:', elapsed);
          onUserJoined?.(remoteUid);
        },

        onUserOffline: (_connection, remoteUid, reason) => {
          console.log('👋 AGORA USER OFFLINE:', remoteUid, 'reason:', reason);
          onUserOffline?.(remoteUid);
        },

        onError: (err, msg) => {
          console.log('❌ AGORA ERROR CODE:', err);
          console.log('❌ AGORA ERROR MESSAGE:', msg);
          onError?.(`Agora error ${err} ${msg ?? ''}`);
        },

        onConnectionStateChanged: (_connection, state, reason) => {
          console.log('AGORA CONNECTION STATE:', state, 'REASON:', reason);
        },
      });

      engine.initialize({ appId: agoraData.appId });

      try {
        console.log('AGORA SDK VERSION:', engine.getVersion?.());
      } catch {
        console.log('AGORA SDK VERSION: no disponible');
      }
    }

    await engine.enableAudio();

    await engine.setAudioProfile(
      AudioProfileType.AudioProfileDefault,
      AudioScenarioType.AudioScenarioGameStreaming
    );

    console.log('Intentando conectar Agora con token real...');

    await engine.joinChannel(agoraData.token, channelName, agoraData.uid, {
      channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
    });

    await engine.muteLocalAudioStream(true);

    console.log('joinChannel llamado correctamente con token');
  } catch (error: any) {
    console.log('❌ INIT AGORA ERROR:', error);
    onError?.(error?.message ?? 'Error iniciando Agora');
  }
}

export async function setAgoraMicMuted(muted: boolean) {
  if (!engine || !joinedChannel) {
    console.log('setAgoraMicMuted ignorado. Engine o canal no listo.');
    return;
  }

  await engine.muteLocalAudioStream(muted);
  console.log('MIC MUTED:', muted);
}

export async function destroyAgoraVoice() {
  if (!engine) return;

  try {
    if (joinedChannel) {
      await engine.leaveChannel();
      console.log('AGORA LEFT CHANNEL');
    }
  } finally {
    joinedChannel = false;
    engine.release();
    engine = null;
    console.log('AGORA ENGINE RELEASED');
  }
}