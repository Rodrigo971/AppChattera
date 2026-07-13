import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { destroyAgoraVoice, initAgoraVoice, setAgoraMicMuted } from '../lib/agoraVoice';
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
  seat_number: number | null;
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

  const listRef = useRef<ScrollView>(null);
  const giftOpacity = useRef(new Animated.Value(0)).current;
  const giftTranslateY = useRef(new Animated.Value(40)).current;
  const giftScale = useRef(new Animated.Value(0.75)).current;

  const [micOn, setMicOn] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioJoining, setAudioJoining] = useState(false);
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
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [giftSending, setGiftSending] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [seatLoading, setSeatLoading] = useState(false);

  const host = participants[0];
  const speakers = useMemo(
    () => participants.filter((item) => item.mic_on || item.is_speaker),
    [participants]
  );

  const topUsers = useMemo(() => participants.slice(0, 3), [participants]);
  const roomSeats = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const seatNumber = index + 1;

        return (
          participants.find(
            (participant) =>
              participant.user_id !== host?.user_id &&
              participant.seat_number === seatNumber
          ) ?? null
        );
      }),
    [participants, host?.user_id]
  );

  const myParticipant = useMemo(
    () => participants.find((participant) => participant.user_id === myUserId) ?? null,
    [participants, myUserId]
  );

  const runGiftAnimation = useCallback(
    (gift: RoomGift) => {
      setLastGift(gift);

      giftOpacity.stopAnimation();
      giftTranslateY.stopAnimation();
      giftScale.stopAnimation();

      giftOpacity.setValue(0);
      giftTranslateY.setValue(45);
      giftScale.setValue(0.72);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(giftOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(giftScale, {
            toValue: 1.08,
            friction: 5,
            tension: 90,
            useNativeDriver: true,
          }),
          Animated.timing(giftTranslateY, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1350),
        Animated.parallel([
          Animated.timing(giftOpacity, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(giftScale, {
            toValue: 1.18,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(giftTranslateY, {
            toValue: -72,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setLastGift(null);
      });
    },
    [giftOpacity, giftScale, giftTranslateY]
  );


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

  const loadFollowing = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) {
      console.log('Error cargando seguidos:', error.message);
      return;
    }

    setFollowingIds((data || []).map((item: { following_id: string }) => item.following_id));
  }, []);

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

      try {
        setAudioJoining(true);
        await initAgoraVoice({
          channelName: roomId,
          onJoined: () => {
  console.log('✅ AUDIO REAL CONECTADO');
  setAudioReady(true);
  setMicOn(false);
},
onError: (message) => {
  console.log('❌ Agora error en room:', message);
  setAudioReady(false);
},
        });
      } catch (error: any) {
        console.log('Error iniciando Agora:', error?.message || error);
        Alert.alert(
          'Audio no disponible',
          'No se pudo iniciar el audio real. La sala seguirá funcionando en modo visual.'
        );
      } finally {
        setAudioJoining(false);
      }

      setMessages([]);
      await loadParticipants();
      await loadFollowing(profile.userId);
    };

    startRoom();
  }, [roomId, loadMyProfile, joinRoom, loadParticipants, loadFollowing]);

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
        (payload) => {
          const changedParticipant = payload.new as RoomParticipant;
          const oldParticipant = payload.old as Partial<RoomParticipant>;

          setParticipants((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((item) => item.id !== oldParticipant.id);
            }

            const exists = prev.some((item) => item.id === changedParticipant.id);

            if (exists) {
              return prev.map((item) =>
                item.id === changedParticipant.id ? changedParticipant : item
              );
            }

            return [...prev, changedParticipant].sort(
              (a, b) =>
                new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
            );
          });
        }
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

          if (newGift.from_user_id !== myUserId) {
            runGiftAnimation(newGift);
          }

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(giftsChannel);
    };
  }, [roomId, myUserId, runGiftAnimation]);

  useEffect(() => {
    return () => {
      setAgoraMicMuted(true);
      destroyAgoraVoice();
      leaveRoomFromDb();
    };
  }, [leaveRoomFromDb]);

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, [messages]);

  const chooseSeat = async (seatNumber: number) => {
    if (!roomId || !myUserId || seatLoading) return;

    const occupiedSeat = participants.find(
      (participant) =>
        participant.seat_number === seatNumber &&
        participant.user_id !== myUserId
    );

    if (occupiedSeat) {
      Alert.alert(
        'Asiento ocupado',
        `El asiento ${seatNumber} ya está ocupado por ${
          occupiedSeat.username || 'otro usuario'
        }.`
      );
      return;
    }

    if (host?.user_id === myUserId) {
      Alert.alert(
        'Sos el anfitrión',
        'El anfitrión permanece en el lugar principal de la sala.'
      );
      return;
    }

    try {
      setSeatLoading(true);

      const { error } = await supabase
        .from('room_participants')
        .update({ seat_number: seatNumber })
        .eq('room_id', roomId)
        .eq('user_id', myUserId);

      if (error) {
        const isSeatConflict =
          error.code === '23505' ||
          error.message.toLowerCase().includes('unique');

        Alert.alert(
          isSeatConflict ? 'Asiento ocupado' : 'No se pudo cambiar de asiento',
          isSeatConflict
            ? `Otra persona ocupó el asiento ${seatNumber} antes que vos.`
            : error.message
        );
        return;
      }

      setParticipants((previous) =>
        previous.map((participant) =>
          participant.user_id === myUserId
            ? { ...participant, seat_number: seatNumber }
            : participant
        )
      );
    } finally {
      setSeatLoading(false);
    }
  };

  const leaveSeat = async () => {
    if (!roomId || !myUserId || seatLoading) return;

    try {
      setSeatLoading(true);

      const { error } = await supabase
        .from('room_participants')
        .update({ seat_number: null })
        .eq('room_id', roomId)
        .eq('user_id', myUserId);

      if (error) {
        Alert.alert('Error', 'No se pudo abandonar el asiento.');
        return;
      }

      setParticipants((previous) =>
        previous.map((participant) =>
          participant.user_id === myUserId
            ? { ...participant, seat_number: null }
            : participant
        )
      );
    } finally {
      setSeatLoading(false);
    }
  };

  const toggleMic = async () => {
  if (!roomId || !myUserId) return;

  const nextMicState = !micOn;

  if (!audioReady) {
    Alert.alert(
      'Audio preparando',
      audioJoining
        ? 'El audio todavía se está conectando.'
        : 'El audio real no está conectado. Probá salir y volver a entrar a la sala.'
    );
    return;
  }

  try {
    await setAgoraMicMuted(!nextMicState);
  } catch (error) {
    console.log('Error muteando Agora:', error);
    Alert.alert('Error', 'No se pudo cambiar el micrófono.');
    return;
  }

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
    await setAgoraMicMuted(nextMicState);
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


  const openUserMenu = (user: RoomParticipant) => {
    setSelectedParticipant(user);
    setUserMenuVisible(true);
  };

  const closeUserMenu = () => {
    setUserMenuVisible(false);
  };

  const goToProfile = () => {
    if (!selectedParticipant) return;
    setUserMenuVisible(false);
    router.push({ pathname: '/user-profile', params: { userId: selectedParticipant.user_id } });
  };

  const goToPrivateChat = () => {
    if (!selectedParticipant) return;
    if (selectedParticipant.user_id === myUserId) {
      Alert.alert('Es tu perfil', 'No podés escribirte a vos mismo.');
      return;
    }

    setUserMenuVisible(false);
    router.push({
      pathname: '/chat',
      params: {
        userId: selectedParticipant.user_id,
        username: selectedParticipant.username || 'Usuario',
      },
    });
  };

  const toggleFollowSelected = async () => {
    if (!selectedParticipant || !myUserId || followLoading) return;

    if (selectedParticipant.user_id === myUserId) {
      Alert.alert('Es tu perfil', 'No podés seguirte a vos mismo.');
      return;
    }

    const targetId = selectedParticipant.user_id;
    const alreadyFollowing = followingIds.includes(targetId);

    try {
      setFollowLoading(true);
      setFollowingIds((prev) =>
        alreadyFollowing ? prev.filter((id) => id !== targetId) : [...prev, targetId]
      );

      if (alreadyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', myUserId)
          .eq('following_id', targetId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: myUserId,
          following_id: targetId,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      setFollowingIds((prev) =>
        alreadyFollowing ? [...prev, targetId] : prev.filter((id) => id !== targetId)
      );
      Alert.alert('Error', error?.message || 'No se pudo actualizar el seguimiento.');
    } finally {
      setFollowLoading(false);
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
    if (!roomId || !myUserId || !selectedParticipant || giftSending) return;

    if (selectedParticipant.user_id === myUserId) {
      Alert.alert('Elegí otro usuario', 'No podés enviarte regalos a vos mismo.');
      return;
    }

    const receiverId = selectedParticipant.user_id;
    const receiverGain = Math.floor(gift.price * 0.5);
    const senderCoins = coins;

    if (senderCoins < gift.price) {
      Alert.alert('Sin monedas', `Necesitás ${gift.price} monedas.`);
      return;
    }

    const newSenderCoins = senderCoins - gift.price;
    setGiftSending(true);
    setCoins(newSenderCoins);

    const { data: receiverProfile } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', receiverId)
      .maybeSingle();

    const receiverCoins = receiverProfile?.coins ?? 0;
    const newReceiverCoins = receiverCoins + receiverGain;

    const { error: updateSenderError } = await supabase
      .from('profiles')
      .update({ coins: newSenderCoins })
      .eq('id', myUserId);

    if (updateSenderError) {
      setCoins(senderCoins);
      setGiftSending(false);
      Alert.alert('Error', 'No se pudieron descontar las monedas.');
      return;
    }

    const { error: updateReceiverError } = await supabase
      .from('profiles')
      .update({ coins: newReceiverCoins })
      .eq('id', receiverId);

    if (updateReceiverError) {
      await supabase.from('profiles').update({ coins: senderCoins }).eq('id', myUserId);
      setCoins(senderCoins);
      setGiftSending(false);
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

      setCoins(senderCoins);
      setGiftSending(false);
      Alert.alert('Error', 'No se pudo enviar el regalo.');
      return;
    }

    runGiftAnimation({
      id: `local-${Date.now()}`,
      room_id: roomId,
      from_user_id: myUserId,
      from_username: username,
      to_user_id: receiverId,
      to_username: selectedParticipant.username || 'Usuario',
      gift_name: `${gift.icon} ${gift.name}`,
      amount: 1,
      created_at: new Date().toISOString(),
    });

    setGiftModalVisible(false);
    setGiftSending(false);
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
      <View style={styles.ambientGlowOne} />
      <View style={styles.ambientGlowTwo} />
      <View style={styles.ambientGlowThree} />

      {lastGift && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.giftAnimationBox,
            {
              opacity: giftOpacity,
              transform: [
                { translateY: giftTranslateY },
                { scale: giftScale },
              ],
            },
          ]}
        >
          <View style={styles.giftSparkleOne} />
          <View style={styles.giftSparkleTwo} />
          <Text style={styles.giftAnimationIcon}>{lastGift.gift_name}</Text>
          <Text style={styles.giftAnimationTitle}>¡Regalo enviado!</Text>
          <Text style={styles.giftAnimationText}>
            {lastGift.from_username} regaló a {lastGift.to_username}
          </Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <Pressable
          style={styles.headerCircleButton}
          onPress={() =>
            Alert.alert('Salir de la sala', '¿Querés salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: leaveRoom },
            ])
          }
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.logoBox}>
          <Text style={styles.crown}>♛</Text>
          <Text style={styles.brand}>CHATTERA</Text>
          <Text numberOfLines={1} style={styles.headerRoomName}>
            {roomTitle}
          </Text>
        </View>

        <Pressable style={styles.coinCapsule} onPress={refreshCoins}>
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinNumber}>{coins}</Text>
          <Text style={styles.coinPlus}>＋</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.roomHeroCard}>
          <View style={styles.roomImageBox}>
            <Text style={styles.roomImageIcon}>👑</Text>
          </View>

          <View style={styles.roomHeroInfo}>
            <View style={styles.roomTitleRow}>
              <Text numberOfLines={1} style={styles.roomHeroTitle}>
                {roomTitle}
              </Text>
              <Text style={styles.verifyBadge}>✓</Text>
            </View>

            <Text numberOfLines={1} style={styles.roomHeroSubtitle}>
              Conversaciones en vivo · regalos · comunidad premium
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>👥 {participants.length}</Text>
              </View>
              <View style={styles.metaPillLive}>
                <Text style={styles.metaPillLiveText}>● EN VIVO</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>🎙️ {speakers.length}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.quickActionsCard}>
          <Pressable style={styles.quickAction} onPress={() => setChatVisible(true)}>
            <Text style={styles.quickActionIcon}>💬</Text>
            <Text style={styles.quickActionText}>Chat</Text>
          </Pressable>

          <Pressable style={styles.quickAction}>
            <Text style={styles.quickActionIcon}>👥</Text>
            <Text style={styles.quickActionText}>Miembros</Text>
          </Pressable>

          <Pressable style={styles.quickAction} onPress={openGiftPanel}>
            <Text style={styles.quickActionIcon}>🎁</Text>
            <Text style={styles.quickActionText}>Regalar</Text>
          </Pressable>

          <Pressable style={styles.quickAction} onPress={refreshCoins}>
            <Text style={styles.quickActionIcon}>⚙️</Text>
            <Text style={styles.quickActionText}>Ajustes</Text>
          </Pressable>
        </View>

        <View style={styles.premiumRoomScene}>
          <View style={styles.sceneGlowTop} />
          <View style={styles.sceneGlowBottom} />
          <View style={styles.sceneOrnament}>
            <Text style={styles.sceneOrnamentText}>♛</Text>
          </View>

          <View style={styles.sceneHeader}>
            <View>
              <Text style={styles.sceneKicker}>SALA PREMIUM</Text>
              <Text numberOfLines={1} style={styles.sceneTitle}>
                {roomTitle}
              </Text>
            </View>

            <View style={styles.sceneStats}>
              <View style={styles.sceneStatPill}>
                <Text style={styles.sceneStatText}>👥 {participants.length}</Text>
              </View>
              <View style={[styles.sceneStatPill, styles.sceneLivePill]}>
                <Text style={styles.sceneLiveText}>● EN VIVO</Text>
              </View>
            </View>
          </View>

          <View style={styles.hostSpotlight}>
            {host ? (
              <Pressable
                style={styles.hostSeat}
                onPress={() => setSelectedParticipant(host)}
                onLongPress={() => openUserMenu(host)}
              >
                <Text style={styles.hostCrown}>♛</Text>

                <View
                  style={[
                    styles.hostAvatarRing,
                    host.mic_on && styles.hostAvatarSpeaking,
                    selectedParticipant?.user_id === host.user_id && styles.selectedGoldRing,
                  ]}
                >
                  {host.avatar_url ? (
                    <Image source={{ uri: host.avatar_url }} style={styles.hostAvatarImage} />
                  ) : (
                    <View style={styles.hostAvatarFallback}>
                      <Text style={styles.hostAvatarEmoji}>👑</Text>
                    </View>
                  )}

                  <View style={[styles.hostMicBadge, host.mic_on && styles.hostMicBadgeActive]}>
                    <Text style={styles.hostMicBadgeText}>{host.mic_on ? '🎙️' : '🔇'}</Text>
                  </View>
                </View>

                <Text numberOfLines={1} style={styles.hostName}>
                  {host.user_id === myUserId ? 'Tú' : host.username || 'Anfitrión'}
                </Text>

                <View style={styles.hostLabel}>
                  <Text style={styles.hostLabelText}>ANFITRIÓN</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.hostSeat}>
                <View style={styles.emptyHostRing}>
                  <Text style={styles.emptySeatPlus}>＋</Text>
                </View>
                <Text style={styles.emptySeatName}>Anfitrión</Text>
              </View>
            )}
          </View>

          <View style={styles.seatsGrid}>
            {roomSeats.map((user, index) => {
              const isHost = user?.user_id === host?.user_id;

              if (isHost) {
                return (
                  <View key={`host-placeholder-${index}`} style={styles.seatSlot}>
                    <View style={styles.reservedSeat}>
                      <Text style={styles.reservedSeatText}>♛</Text>
                    </View>
                    <Text style={styles.seatNumber}>Host</Text>
                  </View>
                );
              }

              if (!user) {
                return (
                  <Pressable
                    key={`empty-seat-${index}`}
                    style={styles.seatSlot}
                    onPress={() => chooseSeat(index + 1)}
                  >
                    <View style={styles.emptySeatRing}>
                      <Text style={styles.emptySeatPlus}>＋</Text>
                    </View>
                    <Text style={styles.seatNumber}>{index + 1}</Text>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={user.id}
                  style={styles.seatSlot}
                  onPress={() => {
                    if (user.user_id === myUserId) {
                      Alert.alert(
                        `Asiento ${index + 1}`,
                        '¿Querés bajar de este asiento?',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Bajar', onPress: leaveSeat },
                        ]
                      );
                      return;
                    }

                    setSelectedParticipant(user);
                  }}
                  onLongPress={() => openUserMenu(user)}
                >
                  <View
                    style={[
                      styles.seatAvatarRing,
                      user.mic_on && styles.seatAvatarSpeaking,
                      selectedParticipant?.user_id === user.user_id && styles.selectedGoldRing,
                    ]}
                  >
                    {user.avatar_url ? (
                      <Image source={{ uri: user.avatar_url }} style={styles.seatAvatarImage} />
                    ) : (
                      <View style={styles.seatAvatarFallback}>
                        <Text style={styles.seatAvatarEmoji}>{user.mic_on ? '🎙️' : '🙂'}</Text>
                      </View>
                    )}

                    <View style={[styles.seatMicBadge, user.mic_on && styles.seatMicBadgeActive]}>
                      <Text style={styles.seatMicBadgeText}>{user.mic_on ? '🎙️' : '🔇'}</Text>
                    </View>
                  </View>

                  <Text numberOfLines={1} style={styles.seatName}>
                    {user.user_id === myUserId ? 'Tú' : user.username || 'Usuario'}
                  </Text>

                  <Text style={styles.seatStatus}>
                    {user.mic_on ? 'Hablando' : `Asiento ${index + 1}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sceneFooter}>
            <Text style={styles.sceneFooterText}>
              Tocá un asiento vacío para sentarte o cambiar de lugar. Mantené presionado un usuario para ver sus opciones.
            </Text>
          </View>
        </View>

        <View style={styles.giftStripCard}>
          <View style={styles.giftStripHeader}>
            <Text style={styles.giftStripTitle}>Enviar regalo</Text>
            <View style={styles.giftStripCoins}>
              <Text style={styles.giftStripCoinsText}>🪙 {coins}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {gifts.map((gift) => (
              <Pressable
                key={gift.name}
                style={styles.giftMiniCard}
                onPress={() => {
                  if (!selectedParticipant) {
                    const receiver = participants.find((p) => p.user_id !== myUserId) || participants[0];
                    if (receiver) setSelectedParticipant(receiver);
                  }
                  setGiftModalVisible(true);
                }}
              >
                <Text style={styles.giftMiniIcon}>{gift.icon}</Text>
                <Text style={styles.giftMiniName}>{gift.name}</Text>
                <Text style={styles.giftMiniPrice}>🪙 {gift.price}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.rankingsWrapper}>
          <View style={styles.rankingCard}>
            <View style={styles.rankingHeader}>
              <Text style={styles.rankingTitle}>TOP SALA</Text>
              <Text style={styles.rankingSubtitle}>Diario</Text>
            </View>

            {topUsers.length === 0 ? (
              <Text style={styles.emptyRanking}>Todavía no hay ranking.</Text>
            ) : (
              topUsers.map((user, index) => (
                <View key={user.id} style={styles.rankRow}>
                  <Text style={styles.rankPosition}>{index + 1}</Text>
                  <View style={styles.rankAvatar}>
                    <Text style={styles.rankAvatarText}>
                      {user.user_id === host?.user_id ? '👑' : '⭐'}
                    </Text>
                  </View>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {user.user_id === myUserId ? 'Tú' : user.username || 'Usuario'}
                  </Text>
                  <Text style={styles.rankBadge}>{index === 0 ? '3.2h' : index === 1 ? '2.7h' : '2.1h'}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.premiumLevelCard}>
            <Text style={styles.levelShield}>💎</Text>
            <Text style={styles.levelTitle}>Lounge Premium</Text>
            <Text style={styles.levelText}>Nivel 8</Text>
            <View style={styles.levelBar}>
              <View style={styles.levelProgress} />
            </View>
            <Text style={styles.levelXp}>820 / 1200 XP</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomPanel}>
        <View style={styles.actionRow}>
          <Pressable
            style={[
              styles.mainMicButton,
              micOn && styles.mainMicButtonActive,
              (!audioReady || audioJoining) && styles.mainMicButtonDisabled,
            ]}
            onPress={toggleMic}
          >
            <Text style={styles.mainMicIcon}>
              {audioJoining ? '⏳' : micOn ? '🎙️' : '🎤'}
            </Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => setChatVisible(true)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>Chat</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={openGiftPanel}>
            <Text style={styles.actionIcon}>🎁</Text>
            <Text style={styles.actionText}>Regalos</Text>
          </Pressable>

          <Pressable style={styles.actionButtonDanger} onPress={leaveRoom}>
            <Text style={styles.actionIcon}>🚪</Text>
            <Text style={styles.actionTextDanger}>Salir</Text>
          </Pressable>
        </View>

        <Text style={styles.micStatus}>
          {audioJoining
            ? 'Conectando audio...'
            : audioReady
              ? `Micrófono ${micOn ? 'encendido' : 'apagado'}`
              : 'Audio visual · sin conexión real'}
          {myParticipant?.seat_number
            ? ` · Asiento ${myParticipant.seat_number}`
            : host?.user_id === myUserId
              ? ' · Anfitrión'
              : ' · Sin asiento'}
        </Text>
      </View>

      <Modal
        visible={chatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChatVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.chatModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.chatModalCard}>
            <View style={styles.chatModalHeader}>
              <View>
                <Text style={styles.chatModalKicker}>CHAT DE LA SALA</Text>
                <Text numberOfLines={1} style={styles.chatModalTitle}>
                  {roomTitle}
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setChatVisible(false)}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeIcon}>💎</Text>
              <View style={styles.welcomeCopy}>
                <Text style={styles.welcomeTitle}>
                  Bienvenid@ a {roomTitle}
                </Text>
                <Text style={styles.welcomeText}>
                  Respeta a los demás y disfruta una gran conversación.
                </Text>
              </View>
            </View>

            <ScrollView
              ref={listRef}
              style={styles.chatModalMessages}
              contentContainerStyle={styles.messageListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 ? (
                <Text style={styles.emptyChat}>
                  Todavía no hay mensajes. Sé el primero en escribir.
                </Text>
              ) : (
                messages.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.messageRow,
                      item.user_id === myUserId && styles.myMessageRow,
                    ]}
                  >
                    {item.user_id !== myUserId && (
                      <View style={styles.messageAvatar}>
                        <Text style={styles.messageAvatarText}>
                          {(item.username || 'U').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.messageBubble,
                        item.user_id === myUserId && styles.myMessageBubble,
                        item.id.startsWith('gift-') && styles.giftMessageBubble,
                      ]}
                    >
                      <Text style={styles.messageUser}>
                        {item.user_id === myUserId ? 'Tú' : item.username}
                      </Text>
                      <Text style={styles.messageText}>{item.message}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.chatModalInputRow}>
              <View style={styles.inputBox}>
                <Text style={styles.writeIcon}>✎</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Escribe un mensaje..."
                  placeholderTextColor="#8A8A8A"
                  value={message}
                  onChangeText={setMessage}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                />
              </View>

              <Pressable
                style={styles.sendButton}
                onPress={sendMessage}
                disabled={sending}
              >
                <Text style={styles.sendButtonText}>
                  {sending ? '...' : '➤'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={userMenuVisible} transparent animationType="fade">
        <Pressable style={styles.userMenuOverlay} onPress={closeUserMenu}>
          <Pressable style={styles.userMenuCard} onPress={() => {}}>
            <View style={styles.userMenuHeader}>
              <View style={styles.userMenuAvatar}>
                {selectedParticipant?.avatar_url ? (
                  <Image source={{ uri: selectedParticipant.avatar_url }} style={styles.userMenuAvatarImage} />
                ) : (
                  <Text style={styles.userMenuAvatarText}>👤</Text>
                )}
              </View>

              <View style={styles.userMenuInfo}>
                <Text numberOfLines={1} style={styles.userMenuName}>
                  {selectedParticipant?.user_id === myUserId
                    ? 'Tú'
                    : selectedParticipant?.username || 'Usuario'}
                </Text>
                <Text style={styles.userMenuSubtext}>
                  {selectedParticipant?.mic_on ? '🎙️ Hablando ahora' : 'Miembro de la sala'}
                </Text>
              </View>

              <Pressable style={styles.closeButton} onPress={closeUserMenu}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.userMenuActions}>
              <Pressable style={styles.userActionGold} onPress={() => { setUserMenuVisible(false); setGiftModalVisible(true); }}>
                <Text style={styles.userActionIcon}>🎁</Text>
                <Text style={styles.userActionGoldText}>Regalar</Text>
              </Pressable>

              <Pressable style={styles.userAction} onPress={goToProfile}>
                <Text style={styles.userActionIcon}>👤</Text>
                <Text style={styles.userActionText}>Ver perfil</Text>
              </Pressable>

              <Pressable style={styles.userAction} onPress={toggleFollowSelected} disabled={followLoading}>
                <Text style={styles.userActionIcon}>
                  {followingIds.includes(selectedParticipant?.user_id || '') ? '✓' : '＋'}
                </Text>
                <Text style={styles.userActionText}>
                  {followingIds.includes(selectedParticipant?.user_id || '') ? 'Siguiendo' : 'Seguir'}
                </Text>
              </Pressable>

              <Pressable style={styles.userAction} onPress={goToPrivateChat}>
                <Text style={styles.userActionIcon}>💬</Text>
                <Text style={styles.userActionText}>Privado</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
                  disabled={giftSending}
                >
                  <Text style={styles.giftOptionIcon}>{gift.icon}</Text>
                  <Text style={styles.giftOptionName}>{gift.name}</Text>
                  <Text style={styles.giftOptionPrice}>🪙 {gift.price}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const GOLD = '#D9A85C';
const GOLD_LIGHT = '#FFD38A';
const BG = '#07090D';
const CARD = '#111318';
const CARD_SOFT = '#171A21';
const BORDER = '#2B2116';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: 32,
  },
  ambientGlowOne: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: 'rgba(217, 168, 92, 0.17)',
    top: -110,
    left: -160,
  },
  ambientGlowTwo: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(126, 64, 255, 0.13)',
    top: 310,
    right: -190,
  },
  ambientGlowThree: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: 'rgba(255, 211, 138, 0.08)',
    bottom: 80,
    left: -160,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 50,
    marginBottom: 12,
  },
  errorTitle: {
    color: GOLD_LIGHT,
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
    backgroundColor: GOLD,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 18,
    marginTop: 22,
  },
  errorButtonText: {
    color: BG,
    fontWeight: '900',
  },
  giftAnimationBox: {
    position: 'absolute',
    top: 138,
    left: 24,
    right: 24,
    zIndex: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(17, 19, 24, 0.96)',
    borderRadius: 32,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: GOLD,
    shadowColor: GOLD_LIGHT,
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
    overflow: 'hidden',
  },
  giftSparkleOne: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(217, 168, 92, 0.18)',
    top: -62,
    right: -42,
  },
  giftSparkleTwo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(124, 58, 237, 0.16)',
    bottom: -48,
    left: -34,
  },
  giftAnimationIcon: {
    color: '#FFFFFF',
    fontSize: 58,
    fontWeight: '900',
    textShadowColor: GOLD_LIGHT,
    textShadowRadius: 18,
  },
  giftAnimationTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  giftAnimationText: {
    color: GOLD_LIGHT,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 7,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCircleButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(17, 19, 24, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  backText: {
    color: GOLD_LIGHT,
    fontSize: 35,
    fontWeight: '900',
    marginTop: -4,
  },
  logoBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  crown: {
    color: GOLD_LIGHT,
    fontSize: 21,
    fontWeight: '900',
    marginBottom: -3,
  },
  brand: {
    color: GOLD_LIGHT,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  headerRoomName: {
    color: '#A6A6A6',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    maxWidth: 190,
  },
  coinCapsule: {
    minWidth: 86,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(17, 19, 24, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 9,
    flexDirection: 'row',
  },
  coinIcon: {
    fontSize: 17,
    marginRight: 4,
  },
  coinNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    flexShrink: 1,
  },
  coinPlus: {
    color: BG,
    backgroundColor: GOLD,
    width: 23,
    height: 23,
    borderRadius: 12,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 6,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 190,
  },
  roomHeroCard: {
    backgroundColor: 'rgba(17, 19, 24, 0.92)',
    borderRadius: 28,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  roomImageBox: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: '#1D1510',
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  roomImageIcon: {
    fontSize: 36,
  },
  roomHeroInfo: {
    flex: 1,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomHeroTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  verifyBadge: {
    color: BG,
    backgroundColor: GOLD_LIGHT,
    width: 21,
    height: 21,
    borderRadius: 11,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '900',
    marginLeft: 7,
  },
  roomHeroSubtitle: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 7,
  },
  metaPill: {
    backgroundColor: '#0B0D12',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  metaPillText: {
    color: '#D6D6D6',
    fontSize: 11,
    fontWeight: '900',
  },
  metaPillLive: {
    backgroundColor: 'rgba(255, 68, 51, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 51, 0.5)',
  },
  metaPillLiveText: {
    color: '#FF5B45',
    fontSize: 11,
    fontWeight: '900',
  },
  quickActionsCard: {
    backgroundColor: 'rgba(17, 19, 24, 0.9)',
    borderRadius: 26,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickAction: {
    width: '24%',
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1410',
    borderWidth: 1,
    borderColor: '#3A2A18',
    color: GOLD_LIGHT,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 21,
    fontWeight: '900',
  },
  quickActionText: {
    color: '#D8D8D8',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 7,
  },
  premiumRoomScene: {
    position: 'relative',
    backgroundColor: 'rgba(12, 14, 20, 0.96)',
    borderRadius: 32,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 168, 92, 0.42)',
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: GOLD,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 7,
  },
  sceneGlowTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(217, 168, 92, 0.13)',
    top: -110,
    right: -70,
  },
  sceneGlowBottom: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(108, 62, 180, 0.12)',
    bottom: -125,
    left: -85,
  },
  sceneOrnament: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    opacity: 0.055,
  },
  sceneOrnamentText: {
    color: GOLD_LIGHT,
    fontSize: 220,
    fontWeight: '900',
  },
  sceneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    zIndex: 2,
  },
  sceneKicker: {
    color: GOLD_LIGHT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  sceneTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
    maxWidth: 185,
  },
  sceneStats: {
    alignItems: 'flex-end',
    gap: 7,
  },
  sceneStatPill: {
    backgroundColor: 'rgba(5, 7, 11, 0.76)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sceneStatText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  sceneLivePill: {
    borderColor: 'rgba(255, 82, 82, 0.45)',
    backgroundColor: 'rgba(255, 82, 82, 0.10)',
  },
  sceneLiveText: {
    color: '#FF7A6A',
    fontSize: 10,
    fontWeight: '900',
  },
  hostSpotlight: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 18,
    zIndex: 2,
  },
  hostSeat: {
    alignItems: 'center',
    width: 130,
  },
  hostCrown: {
    color: GOLD_LIGHT,
    fontSize: 30,
    marginBottom: -5,
    textShadowColor: GOLD,
    textShadowRadius: 10,
  },
  hostAvatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1410',
    borderWidth: 3,
    borderColor: GOLD_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 9,
  },
  hostAvatarSpeaking: {
    borderColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 22,
  },
  hostAvatarImage: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
  },
  hostAvatarFallback: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
    backgroundColor: '#090B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarEmoji: {
    fontSize: 38,
  },
  hostMicBadge: {
    position: 'absolute',
    right: -2,
    bottom: 4,
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#4D351B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostMicBadgeActive: {
    backgroundColor: GOLD,
    borderColor: GOLD_LIGHT,
  },
  hostMicBadgeText: {
    fontSize: 12,
  },
  hostName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 9,
    maxWidth: 125,
  },
  hostLabel: {
    backgroundColor: '#21170C',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLD,
    paddingHorizontal: 11,
    paddingVertical: 4,
    marginTop: 5,
  },
  hostLabelText: {
    color: GOLD_LIGHT,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  emptyHostRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(217, 168, 92, 0.48)',
    backgroundColor: 'rgba(217, 168, 92, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySeatName: {
    color: '#A8A8A8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  seatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    zIndex: 2,
  },
  seatSlot: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 17,
  },
  seatAvatarRing: {
    width: 61,
    height: 61,
    borderRadius: 31,
    backgroundColor: '#17120D',
    borderWidth: 2,
    borderColor: '#76552D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatAvatarSpeaking: {
    borderColor: GOLD_LIGHT,
    shadowColor: GOLD,
    shadowOpacity: 0.5,
    shadowRadius: 9,
    elevation: 6,
  },
  seatAvatarImage: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
  },
  seatAvatarFallback: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
    backgroundColor: '#090B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatAvatarEmoji: {
    fontSize: 23,
  },
  seatMicBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#4D351B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatMicBadgeActive: {
    backgroundColor: GOLD,
    borderColor: GOLD_LIGHT,
  },
  seatMicBadgeText: {
    fontSize: 9,
  },
  seatName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
    maxWidth: 74,
  },
  seatStatus: {
    color: '#8F8F8F',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 2,
  },
  emptySeatRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(217, 168, 92, 0.38)',
    backgroundColor: 'rgba(217, 168, 92, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySeatPlus: {
    color: GOLD_LIGHT,
    fontSize: 27,
    fontWeight: '500',
  },
  seatNumber: {
    color: '#777D88',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 6,
  },
  reservedSeat: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(217, 168, 92, 0.18)',
    backgroundColor: 'rgba(217, 168, 92, 0.035)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reservedSeatText: {
    color: 'rgba(255, 211, 138, 0.36)',
    fontSize: 22,
  },
  sceneFooter: {
    backgroundColor: 'rgba(5, 7, 11, 0.54)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(217, 168, 92, 0.15)',
    zIndex: 2,
  },
  sceneFooterText: {
    color: '#A9A9A9',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  stageCard: {
    backgroundColor: 'rgba(17, 19, 24, 0.93)',
    borderRadius: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 18,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  stageKicker: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stageTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  stageMicPill: {
    backgroundColor: '#1A1410',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3A2A18',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  stageMicText: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
  },
  stageUsers: {
    minHeight: 165,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stageUser: {
    width: '31%',
    alignItems: 'center',
  },
  stageUserCenter: {
    marginTop: -8,
  },
  stageAvatarRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#1A1410',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GOLD,
  },
  stageAvatarRingBig: {
    width: 105,
    height: 105,
    borderRadius: 53,
    borderWidth: 3,
  },
  stageAvatarSpeaking: {
    shadowColor: GOLD_LIGHT,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  selectedGoldRing: {
    borderColor: '#FFFFFF',
  },
  stageAvatarImage: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
    backgroundColor: '#0B0D12',
  },
  stageAvatarFallback: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
    backgroundColor: '#0B0D12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageAvatarEmoji: {
    fontSize: 32,
  },
  stageUsername: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 9,
    maxWidth: 95,
  },
  hostMiniBadge: {
    marginTop: 6,
    backgroundColor: '#1A1410',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLD,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hostMiniBadgeText: {
    color: GOLD_LIGHT,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyStageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStageText: {
    color: '#A6A6A6',
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    color: GOLD_LIGHT,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionHint: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 190,
    textAlign: 'right',
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 4,
  },
  memberSlot: {
    width: '20%',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 5,
  },
  memberAvatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1A1410',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6C4A21',
  },
  memberAvatarSpeaking: {
    borderColor: GOLD_LIGHT,
  },
  memberAvatarImage: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
    backgroundColor: '#0B0D12',
  },
  memberAvatarFallback: {
    width: '88%',
    height: '88%',
    borderRadius: 999,
    backgroundColor: '#0B0D12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarEmoji: {
    fontSize: 22,
  },
  micDot: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#191919',
    borderWidth: 1,
    borderColor: '#3A2A18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micDotActive: {
    backgroundColor: GOLD,
    borderColor: GOLD_LIGHT,
  },
  micDotText: {
    fontSize: 10,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 7,
    maxWidth: 64,
  },
  emptyParticipantsBox: {
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  emptyParticipants: {
    color: '#B8B8B8',
    textAlign: 'center',
    fontWeight: '800',
  },
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
    justifyContent: 'flex-end',
  },
  chatModalCard: {
    height: '78%',
    backgroundColor: '#0B0D12',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(217, 168, 92, 0.42)',
    padding: 16,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chatModalKicker: {
    color: GOLD_LIGHT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  chatModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
    maxWidth: 260,
  },
  chatModalMessages: {
    flex: 1,
    minHeight: 0,
  },
  chatModalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217, 168, 92, 0.18)',
  },
  chatArea: {
    backgroundColor: 'rgba(8, 10, 15, 0.78)',
    borderRadius: 28,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 168, 92, 0.28)',
    marginBottom: 16,
    height: 300,
    overflow: 'hidden',
  },
  chatTabs: {
    flexDirection: 'row',
    marginBottom: 13,
    backgroundColor: '#0B0D12',
    borderRadius: 18,
    padding: 4,
  },
  activeTab: {
    flex: 1,
    backgroundColor: '#1A1410',
    borderRadius: 14,
    paddingVertical: 9,
    borderBottomWidth: 2,
    borderBottomColor: GOLD_LIGHT,
  },
  activeTabText: {
    color: GOLD_LIGHT,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  inactiveTab: {
    flex: 1,
    paddingVertical: 9,
  },
  inactiveTabText: {
    color: '#8C8C8C',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  welcomeCard: {
    flexDirection: 'row',
    backgroundColor: '#0B0D12',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 13,
    marginBottom: 12,
  },
  welcomeIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  welcomeCopy: {
    flex: 1,
  },
  welcomeTitle: {
    color: GOLD_LIGHT,
    fontSize: 13,
    fontWeight: '900',
  },
  welcomeText: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  messageList: {
    flex: 1,
    minHeight: 0,
  },
  messageListContent: {
    paddingBottom: 6,
  },
  emptyChat: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '700',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1410',
    borderWidth: 1,
    borderColor: '#3A2A18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageAvatarText: {
    color: GOLD_LIGHT,
    fontSize: 10,
    fontWeight: '900',
  },
  messageBubble: {
    backgroundColor: CARD_SOFT,
    borderRadius: 18,
    padding: 12,
    maxWidth: '82%',
    borderWidth: 1,
    borderColor: '#20232B',
  },
  myMessageBubble: {
    borderColor: GOLD,
    backgroundColor: '#1A1410',
  },
  giftMessageBubble: {
    backgroundColor: '#21180D',
    borderColor: GOLD,
  },
  messageUser: {
    color: GOLD_LIGHT,
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
  giftStripCard: {
    backgroundColor: 'rgba(17, 19, 24, 0.94)',
    borderRadius: 25,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  giftStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  giftStripTitle: {
    color: GOLD_LIGHT,
    fontSize: 16,
    fontWeight: '900',
  },
  giftStripCoins: {
    backgroundColor: '#1A1410',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: BORDER,
  },
  giftStripCoinsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  giftMiniCard: {
    width: 86,
    backgroundColor: '#0B0D12',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 10,
  },
  giftMiniIcon: {
    fontSize: 28,
  },
  giftMiniName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
  },
  giftMiniPrice: {
    color: GOLD_LIGHT,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
  },
  rankingsWrapper: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  rankingCard: {
    flex: 1.2,
    backgroundColor: 'rgba(17, 19, 24, 0.94)',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rankingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankingTitle: {
    color: GOLD_LIGHT,
    fontSize: 14,
    fontWeight: '900',
  },
  rankingSubtitle: {
    color: '#B8B8B8',
    fontSize: 11,
    fontWeight: '800',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rankPosition: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: GOLD,
    color: BG,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '900',
    marginRight: 8,
  },
  rankAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0B0D12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rankAvatarText: {
    fontSize: 13,
  },
  rankName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  rankBadge: {
    color: '#B8B8B8',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyRanking: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '700',
  },
  premiumLevelCard: {
    flex: 0.9,
    backgroundColor: 'rgba(17, 19, 24, 0.94)',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelShield: {
    fontSize: 38,
    marginBottom: 6,
  },
  levelTitle: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  levelBar: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2A2440',
    marginTop: 12,
    overflow: 'hidden',
  },
  levelProgress: {
    width: '62%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: GOLD,
  },
  levelXp: {
    color: '#A6A6A6',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 7,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: 'rgba(7, 9, 13, 0.985)',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputBox: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: CARD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  writeIcon: {
    color: GOLD_LIGHT,
    fontSize: 19,
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: BG,
    fontSize: 21,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 11,
  },
  mainMicButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1A1410',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GOLD,
  },
  mainMicButtonActive: {
    backgroundColor: GOLD,
    shadowColor: GOLD_LIGHT,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  mainMicIcon: {
    fontSize: 31,
  },
  mainMicButtonDisabled: {
    opacity: 0.55,
  },
  actionButton: {
    flex: 1,
    height: 54,
    borderRadius: 22,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  actionButtonDanger: {
    flex: 1,
    height: 54,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  actionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  actionTextDanger: {
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '900',
  },
  micStatus: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },

  userMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  userMenuCard: {
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  userMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userMenuAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1A1410',
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  userMenuAvatarImage: {
    width: '100%',
    height: '100%',
  },
  userMenuAvatarText: {
    fontSize: 25,
  },
  userMenuInfo: {
    flex: 1,
  },
  userMenuName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  userMenuSubtext: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  userMenuActions: {
    flexDirection: 'row',
    gap: 9,
  },
  userActionGold: {
    flex: 1,
    backgroundColor: GOLD,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  userAction: {
    flex: 1,
    backgroundColor: '#0B0D12',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  userActionIcon: {
    fontSize: 18,
    marginBottom: 5,
  },
  userActionGoldText: {
    color: BG,
    fontSize: 11,
    fontWeight: '900',
  },
  userActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  giftPanel: {
    backgroundColor: CARD,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  giftPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  giftPanelTitle: {
    color: GOLD_LIGHT,
    fontSize: 22,
    fontWeight: '900',
  },
  giftReceiver: {
    color: '#B8B8B8',
    fontSize: 13,
    marginTop: 5,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
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
    borderRadius: 20,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A2A18',
  },
  giftOptionIcon: {
    fontSize: 31,
  },
  giftOptionName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },
  giftOptionPrice: {
    color: GOLD_LIGHT,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
  },
});
