import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type RoomMessage = {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
};

type RoomParticipant = {
  id: string;
  room_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  is_speaker: boolean;
  mic_on: boolean;
  joined_at: string;
};

type RoomGift = {
  id: string;
  room_id: string;
  from_user_id: string;
  from_username: string;
  to_user_id: string;
  to_username: string;
  gift_name: string;
  amount: number;
  created_at: string;
};

const gifts = [
  { name: 'Estrella', icon: '⭐', price: 10 },
  { name: 'Rosa', icon: '🌹', price: 20 },
  { name: 'Corona', icon: '👑', price: 50 },
  { name: 'Diamante', icon: '💎', price: 100 },
];

export default function RoomScreen() {
  const params = useLocalSearchParams<{
    roomId?: string;
    title?: string;
  }>();

  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const roomTitle = typeof params.title === 'string' ? params.title : 'Sala de voz';

  const listRef = useRef<FlatList<RoomMessage>>(null);

  const [micOn, setMicOn] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [myUserId, setMyUserId] = useState('');
  const [username, setUsername] = useState('Usuario');
  const [coins, setCoins] = useState(0);
  const [sending, setSending] = useState(false);
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [selectedParticipant, setSelectedParticipant] =
    useState<RoomParticipant | null>(null);
  const [lastGift, setLastGift] = useState<RoomGift | null>(null);

  const host = participants[0];
  const speakers = useMemo(
    () => participants.filter((item) => item.mic_on || item.is_speaker),
    [participants]
  );

  const topUsers = useMemo(() => participants.slice(0, 3), [participants]);

  const loadMyProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) return null;

    setMyUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url, coins')
      .eq('id', user.id)
      .maybeSingle();

    const finalUsername = profile?.username || user.email || 'Usuario';

    setUsername(finalUsername);
    setCoins(profile?.coins ?? 0);

    return {
      userId: user.id,
      username: finalUsername,
      avatarUrl: profile?.avatar_url || null,
    };
  }, []);

  const joinRoom = useCallback(
    async (userId: string, finalUsername: string, finalAvatar: string | null) => {
      if (!roomId) return;

      const { error } = await supabase.from('room_participants').upsert(
        {
          room_id: roomId,
          user_id: userId,
          username: finalUsername,
          avatar_url: finalAvatar,
          mic_on: false,
          is_speaker: false,
        },
        { onConflict: 'room_id,user_id' }
      );

      if (error) console.log('Error entrando a la sala:', error.message);
    },
    [roomId]
  );

  const loadMessages = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (error) {
      console.log('Error cargando mensajes:', error.message);
      return;
    }

    setMessages(data || []);
  }, [roomId]);

  const loadParticipants = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.log('Error cargando participantes:', error.message);
      return;
    }

    setParticipants(data || []);
  }, [roomId]);

  const refreshCoins = async () => {
    if (!myUserId) return;

    const { data } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', myUserId)
      .maybeSingle();

    setCoins(data?.coins ?? 0);
  };

  const leaveRoomFromDb = useCallback(async () => {
    if (!roomId || !myUserId) return;

    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', myUserId);
  }, [roomId, myUserId]);

  const leaveRoom = async () => {
    await leaveRoomFromDb();
    router.back();
  };

  useEffect(() => {
    const startRoom = async () => {
      if (!roomId) return;

      const profile = await loadMyProfile();

      if (!profile) {
        Alert.alert('Error', 'Tenés que iniciar sesión para entrar a la sala.');
        router.back();
        return;
      }

      await joinRoom(profile.userId, profile.username, profile.avatarUrl);
      await loadMessages();
      await loadParticipants();
    };

    startRoom();
  }, [roomId, loadMyProfile, joinRoom, loadMessages, loadParticipants]);

  useEffect(() => {
    if (!roomId) return;

    const messagesChannel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as RoomMessage;

          setMessages((prev) => {
            const exists = prev.some((item) => item.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel(`room-participants-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => loadParticipants()
      )
      .subscribe();

    const giftsChannel = supabase
      .channel(`room-gifts-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_gifts',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newGift = payload.new as RoomGift;
          setLastGift(newGift);

          setMessages((prev) => [
            ...prev,
            {
              id: `gift-${newGift.id}`,
              room_id: roomId,
              user_id: newGift.from_user_id,
              username: newGift.from_username,
              message: `🎁 envió ${newGift.gift_name} x${newGift.amount} a ${newGift.to_username}`,
              created_at: newGift.created_at,
            },
          ]);

          setTimeout(() => setLastGift(null), 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(giftsChannel);
    };
  }, [roomId, loadParticipants]);

  useEffect(() => {
    return () => {
      leaveRoomFromDb();
    };
  }, [leaveRoomFromDb]);

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, [messages]);

  const toggleMic = async () => {
    if (!roomId || !myUserId) return;

    const nextMicState = !micOn;
    setMicOn(nextMicState);

    const { error } = await supabase
      .from('room_participants')
      .update({
        mic_on: nextMicState,
        is_speaker: nextMicState,
      })
      .eq('room_id', roomId)
      .eq('user_id', myUserId);

    if (error) {
      console.log('Error actualizando micrófono:', error.message);
      setMicOn(!nextMicState);
    }
  };

  const sendMessage = async () => {
    const cleanMessage = message.trim();

    if (!cleanMessage || sending || !myUserId || !roomId) return;

    try {
      setSending(true);

      const { data, error } = await supabase
        .from('room_messages')
        .insert({
          room_id: roomId,
          user_id: myUserId,
          username,
          message: cleanMessage,
        })
        .select()
        .single();

      if (error) {
        console.log('ERROR ENVIANDO MENSAJE:', error);
        Alert.alert('Error enviando mensaje', error.message);
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === data.id);
        if (exists) return prev;
        return [...prev, data as RoomMessage];
      });

      setMessage('');
    } finally {
      setSending(false);
    }
  };

  const openGiftPanel = () => {
    const receiver =
      selectedParticipant ||
      participants.find((p) => p.user_id !== myUserId) ||
      participants[0];

    if (!receiver) {
      Alert.alert('Sin usuarios', 'No hay participantes para enviar regalos.');
      return;
    }

    setSelectedParticipant(receiver);
    setGiftModalVisible(true);
  };

  const sendGift = async (gift: { name: string; icon: string; price: number }) => {
    if (!roomId || !myUserId || !selectedParticipant) return;

    const receiverId = selectedParticipant.user_id;
    const receiverGain = Math.floor(gift.price * 0.5);

    const { data: senderProfile, error: senderError } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', myUserId)
      .maybeSingle();

    if (senderError) {
      Alert.alert('Error', 'No se pudieron verificar tus monedas.');
      return;
    }

    const senderCoins = senderProfile?.coins ?? 0;

    if (senderCoins < gift.price) {
      Alert.alert('Sin monedas', `Necesitás ${gift.price} monedas.`);
      return;
    }

    const { data: receiverProfile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', receiverId)
      .maybeSingle();

    const receiverCoins = receiverProfile?.coins ?? 0;

    const newSenderCoins = senderCoins - gift.price;
    const newReceiverCoins = receiverCoins + receiverGain;

    const { error: updateSenderError } = await supabase
      .from('profiles')
      .update({ coins: newSenderCoins })
      .eq('id', myUserId);

    if (updateSenderError) {
      Alert.alert('Error', 'No se pudieron descontar las monedas.');
      return;
    }

    const { error: updateReceiverError } = await supabase
      .from('profiles')
      .update({ coins: newReceiverCoins })
      .eq('id', receiverId);

    if (updateReceiverError) {
      await supabase.from('profiles').update({ coins: senderCoins }).eq('id', myUserId);
      Alert.alert('Error', 'No se pudo acreditar al receptor.');
      return;
    }

    const { error: giftError } = await supabase.from('room_gifts').insert({
      room_id: roomId,
      from_user_id: myUserId,
      from_username: username,
      to_user_id: receiverId,
      to_username: selectedParticipant.username || 'Usuario',
      gift_name: `${gift.icon} ${gift.name}`,
      amount: 1,
      gift_price: gift.price,
      receiver_gain: receiverGain,
    });

    if (giftError) {
      await supabase.from('profiles').update({ coins: senderCoins }).eq('id', myUserId);
      await supabase.from('profiles').update({ coins: receiverCoins }).eq('id', receiverId);

      Alert.alert('Error', 'No se pudo enviar el regalo.');
      return;
    }

    setCoins(newSenderCoins);
    setGiftModalVisible(false);
  };

  if (!roomId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>🎙️</Text>
        <Text style={styles.errorTitle}>No se recibió el ID de la sala</Text>
        <Text style={styles.errorText}>
          Volvé a la lista de salas y entrá desde una sala activa.
        </Text>

        <Pressable style={styles.errorButton} onPress={() => router.replace('/voice-rooms')}>
          <Text style={styles.errorButtonText}>Ir a salas</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.goldGlowTop} />
      <View style={styles.goldGlowBottom} />

      {lastGift && (
        <View style={styles.giftAnimationBox}>
          <Text style={styles.giftAnimationIcon}>{lastGift.gift_name}</Text>
          <Text style={styles.giftAnimationText}>
            {lastGift.from_username} regaló a {lastGift.to_username}
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() =>
            Alert.alert('Salir de la sala', '¿Querés salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: leaveRoom },
            ])
          }
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>CHATTERA LIVE</Text>
          <Text numberOfLines={1} style={styles.roomName}>
            {roomTitle}
          </Text>
          <View style={styles.liveRow}>
            <Text style={styles.liveDot}>●</Text>
            <Text style={styles.roomSub}>
              En vivo · {participants.length} usuarios · {speakers.length} hablando
            </Text>
          </View>
        </View>

        <Pressable style={styles.coinButton} onPress={refreshCoins}>
          <Text style={styles.coinButtonText}>💰</Text>
          <Text style={styles.coinNumber}>{coins}</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.stageCard}>
          <View style={styles.stageHeader}>
            <View>
              <Text style={styles.stageKicker}>ESCENARIO PRINCIPAL</Text>
              <Text style={styles.stageTitle}>Voz, chat y regalos en vivo</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>● LIVE</Text>
            </View>
          </View>

          <View style={styles.hostBox}>
            <View style={styles.hostAvatarOuter}>
              <View style={styles.hostAvatarInner}>
                <Text style={styles.hostEmoji}>{host?.mic_on ? '🎤' : '👑'}</Text>
              </View>
            </View>

            <View style={styles.hostInfo}>
              <Text style={styles.hostLabel}>ANFITRIÓN</Text>
              <Text numberOfLines={1} style={styles.hostName}>
                {host?.user_id === myUserId ? 'Tú' : host?.username || 'Esperando host'}
              </Text>
              <Text style={styles.hostStatus}>
                {host?.mic_on ? 'Hablando ahora' : 'Sala abierta'}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{participants.length}</Text>
              <Text style={styles.statLabel}>Usuarios</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{speakers.length}</Text>
              <Text style={styles.statLabel}>Mic activos</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{messages.length}</Text>
              <Text style={styles.statLabel}>Mensajes</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Participantes</Text>
          <Text style={styles.sectionHint}>Toca uno para regalar</Text>
        </View>

        <View style={styles.grid}>
          {participants.map((user) => (
            <Pressable
              key={user.id}
              style={styles.userSlot}
              onPress={() => setSelectedParticipant(user)}
            >
              <View
                style={[
                  styles.avatarRing,
                  user.mic_on && styles.speakerRing,
                  selectedParticipant?.user_id === user.user_id && styles.selectedRing,
                ]}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarEmoji}>
                    {user.user_id === host?.user_id ? '👑' : user.mic_on ? '🎤' : '🙂'}
                  </Text>
                </View>
              </View>

              <Text numberOfLines={1} style={styles.username}>
                {user.user_id === myUserId ? 'Tú' : user.username || 'Usuario'}
              </Text>

              <View style={[styles.rolePill, user.mic_on && styles.rolePillActive]}>
                <Text style={[styles.roleText, user.mic_on && styles.roleTextActive]}>
                  {user.mic_on ? 'Hablando' : 'Oyente'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {participants.length === 0 && (
          <View style={styles.emptyParticipantsBox}>
            <Text style={styles.emptyParticipants}>Entrando a la sala...</Text>
          </View>
        )}

        <View style={styles.rankingCard}>
          <View style={styles.rankingHeader}>
            <Text style={styles.rankingTitle}>🏆 Ranking de la sala</Text>
            <Text style={styles.rankingSubtitle}>Top participantes</Text>
          </View>

          {topUsers.length === 0 ? (
            <Text style={styles.emptyRanking}>Todavía no hay ranking.</Text>
          ) : (
            topUsers.map((user, index) => (
              <View key={user.id} style={styles.rankRow}>
                <Text style={styles.rankPosition}>{index + 1}</Text>
                <Text style={styles.rankName} numberOfLines={1}>
                  {user.user_id === myUserId ? 'Tú' : user.username || 'Usuario'}
                </Text>
                <Text style={styles.rankBadge}>{index === 0 ? '👑' : '⭐'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.chatArea}>
          <View style={styles.chatHeader}>
            <Text style={styles.systemTitle}>💬 Chat en vivo</Text>
            <Text style={styles.chatCount}>{messages.length}</Text>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyChat}>Todavía no hay mensajes.</Text>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.messageBubble,
                  item.user_id === myUserId && styles.myMessageBubble,
                ]}
              >
                <Text style={styles.messageUser}>
                  {item.user_id === myUserId ? 'Tú' : item.username}
                </Text>
                <Text style={styles.messageText}>{item.message}</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>

      <View style={styles.bottomPanel}>
        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <Text style={styles.writeIcon}>✎</Text>
            <TextInput
              style={styles.input}
              placeholder="Escribe algo..."
              placeholderTextColor="#9CA3AF"
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
          </View>

          <Pressable style={styles.sendButton} onPress={sendMessage} disabled={sending}>
            <Text style={styles.sendButtonText}>{sending ? '...' : '➤'}</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, micOn && styles.micActive]}
            onPress={toggleMic}
          >
            <Text style={styles.actionIcon}>{micOn ? '🎤' : '🔇'}</Text>
            <Text style={[styles.actionText, micOn && styles.actionTextActive]}>
              {micOn ? 'Mic activo' : 'Mic off'}
            </Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={openGiftPanel}>
            <Text style={styles.actionIcon}>🎁</Text>
            <Text style={styles.actionText}>Regalo</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={refreshCoins}>
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionText}>Monedas</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={giftModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.giftPanel}>
            <View style={styles.giftPanelHeader}>
              <View>
                <Text style={styles.giftPanelTitle}>Enviar regalo</Text>
                <Text style={styles.giftReceiver}>
                  Para:{' '}
                  {selectedParticipant?.user_id === myUserId
                    ? 'Tú'
                    : selectedParticipant?.username || 'Usuario'}
                </Text>
              </View>

              <Pressable style={styles.closeButton} onPress={() => setGiftModalVisible(false)}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.giftGrid}>
              {gifts.map((gift) => (
                <Pressable
                  key={gift.name}
                  style={styles.giftOption}
                  onPress={() => sendGift(gift)}
                >
                  <Text style={styles.giftOptionIcon}>{gift.icon}</Text>
                  <Text style={styles.giftOptionName}>{gift.name}</Text>
                  <Text style={styles.giftOptionPrice}>💰 {gift.price}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090D',
    paddingTop: 32,
  },
  goldGlowTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(217, 168, 92, 0.16)',
    top: 40,
    left: -150,
  },
  goldGlowBottom: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 211, 138, 0.08)',
    bottom: 90,
    right: -170,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#07090D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    color: '#FFD38A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorText: {
    color: '#CBD5E1',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  errorButton: {
    backgroundColor: '#D9A85C',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 20,
  },
  errorButtonText: {
    color: '#07090D',
    fontWeight: '900',
  },
  giftAnimationBox: {
    position: 'absolute',
    top: 182,
    left: 24,
    right: 24,
    zIndex: 50,
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D9A85C',
  },
  giftAnimationIcon: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
  },
  giftAnimationText: {
    color: '#FFD38A',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2B2116',
    marginRight: 10,
  },
  backText: {
    color: '#FFD38A',
    fontSize: 34,
    fontWeight: '900',
    marginTop: -3,
  },
  headerCenter: {
    flex: 1,
    paddingRight: 10,
  },
  kicker: {
    color: '#D9A85C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  roomName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  liveDot: {
    color: '#22C55E',
    fontSize: 10,
    marginRight: 5,
  },
  roomSub: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '800',
  },
  coinButton: {
    minWidth: 58,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9A85C',
    paddingHorizontal: 8,
  },
  coinButtonText: {
    fontSize: 18,
  },
  coinNumber: {
    color: '#FFD38A',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 175,
  },
  stageCard: {
    backgroundColor: '#111318',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2B2116',
    marginBottom: 18,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageKicker: {
    color: '#D9A85C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stageTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  liveBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderColor: '#22C55E',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  liveBadgeText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '900',
  },
  hostBox: {
    marginTop: 18,
    backgroundColor: '#1A1410',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3A2A18',
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatarOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#D9A85C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  hostAvatarInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#07090D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostEmoji: {
    fontSize: 31,
  },
  hostInfo: {
    flex: 1,
  },
  hostLabel: {
    color: '#D9A85C',
    fontSize: 11,
    fontWeight: '900',
  },
  hostName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },
  hostStatus: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#07090D',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  statNumber: {
    color: '#FFD38A',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: '#B8B8B8',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionHint: {
    color: '#D9A85C',
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  userSlot: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#1A1410',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3A2A18',
  },
  speakerRing: {
    borderColor: '#FFD38A',
    backgroundColor: '#3A2A18',
  },
  selectedRing: {
    borderColor: '#22C55E',
    borderWidth: 3,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 25,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
    maxWidth: 68,
  },
  rolePill: {
    marginTop: 4,
    backgroundColor: '#111318',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  rolePillActive: {
    backgroundColor: '#20180E',
    borderColor: '#D9A85C',
  },
  roleText: {
    color: '#B8B8B8',
    fontSize: 8,
    fontWeight: '900',
  },
  roleTextActive: {
    color: '#FFD38A',
  },
  emptyParticipantsBox: {
    backgroundColor: '#111318',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2B2116',
    marginBottom: 16,
  },
  emptyParticipants: {
    color: '#B8B8B8',
    textAlign: 'center',
    fontWeight: '800',
  },
  rankingCard: {
    backgroundColor: '#111318',
    borderRadius: 24,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2B2116',
    marginBottom: 18,
  },
  rankingHeader: {
    marginBottom: 10,
  },
  rankingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  rankingSubtitle: {
    color: '#D9A85C',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07090D',
    borderRadius: 16,
    padding: 11,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  rankPosition: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D9A85C',
    color: '#07090D',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 13,
    fontWeight: '900',
    marginRight: 10,
  },
  rankName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  rankBadge: {
    fontSize: 18,
  },
  emptyRanking: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '700',
  },
  chatArea: {
    backgroundColor: '#111318',
    borderRadius: 24,
    padding: 15,
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  systemTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  chatCount: {
    color: '#07090D',
    backgroundColor: '#D9A85C',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyChat: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
  },
  messageBubble: {
    backgroundColor: '#07090D',
    borderRadius: 18,
    padding: 12,
    alignSelf: 'flex-start',
    maxWidth: '88%',
    borderWidth: 1,
    borderColor: '#2B2116',
    marginBottom: 10,
  },
  myMessageBubble: {
    alignSelf: 'flex-end',
    borderColor: '#D9A85C',
    backgroundColor: '#1A1410',
  },
  messageUser: {
    color: '#FFD38A',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 5,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: 'rgba(7, 9, 13, 0.98)',
    borderTopWidth: 1,
    borderTopColor: '#2B2116',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputBox: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#111318',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  writeIcon: {
    color: '#FFD38A',
    fontSize: 20,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D9A85C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#07090D',
    fontSize: 21,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    height: 46,
    borderRadius: 18,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2B2116',
    flexDirection: 'row',
    gap: 6,
  },
  micActive: {
    backgroundColor: '#D9A85C',
    borderColor: '#F0C987',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  actionTextActive: {
    color: '#07090D',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.64)',
    justifyContent: 'flex-end',
  },
  giftPanel: {
    backgroundColor: '#111318',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  giftPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  giftPanelTitle: {
    color: '#FFD38A',
    fontSize: 21,
    fontWeight: '900',
  },
  giftReceiver: {
    color: '#B8B8B8',
    fontSize: 13,
    marginTop: 5,
    fontWeight: '800',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: '#07090D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  giftGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  giftOption: {
    flex: 1,
    backgroundColor: '#1A1410',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A2A18',
  },
  giftOptionIcon: {
    fontSize: 30,
  },
  giftOptionName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },
  giftOptionPrice: {
    color: '#FFD38A',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
});