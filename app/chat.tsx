import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createMessageNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';

type Message = {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

type TypingStatusRow = {
  user_id: string;
  chat_with_user_id: string;
  is_typing: boolean;
  updated_at: string;
};

type OtherUserPresence = {
  is_online?: boolean;
  last_seen?: string | null;
};

export default function ChatScreen() {
  const { userId, username } = useLocalSearchParams<{
    userId: string;
    username: string;
  }>();

  const [myUserId, setMyUserId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [coins, setCoins] = useState(0);
  const [isMutual, setIsMutual] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserPresence, setOtherUserPresence] =
    useState<OtherUserPresence | null>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatBackground =
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=1200&auto=format&fit=crop';

  useEffect(() => {
    loadChatData();
  }, []);

  useEffect(() => {
    if (!myUserId || !userId) return;

    const otherUserId = String(userId);

    const channel = supabase
      .channel(`chat-${myUserId}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          const isCurrentChat =
            (newMessage.sender_id === myUserId &&
              newMessage.receiver_id === otherUserId) ||
            (newMessage.sender_id === otherUserId &&
              newMessage.receiver_id === myUserId);

          if (!isCurrentChat) return;

          setMessages((prev) => {
            if (prev.find((m) => m.id === newMessage.id)) return prev;
            return [newMessage, ...prev];
          });

          if (newMessage.receiver_id === myUserId) {
            await markMessagesAsRead(myUserId, otherUserId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId, userId]);

  useEffect(() => {
    if (!myUserId || !userId) return;

    const otherUserId = String(userId);

    loadTypingStatus();

    const typingChannel = supabase
      .channel(`typing-${myUserId}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
        },
        (payload) => {
          const row = (payload.new || payload.old) as
            | TypingStatusRow
            | undefined;

          if (!row) return;

          const isThisChatPair =
            row.user_id === otherUserId && row.chat_with_user_id === myUserId;

          if (!isThisChatPair) return;

          if (payload.eventType === 'DELETE') {
            setOtherUserTyping(false);
            return;
          }

          setOtherUserTyping(!!payload.new?.is_typing);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [myUserId, userId]);

  useEffect(() => {
    if (!userId) return;

    const otherUserId = String(userId);

    loadOtherUserPresence();

    const presenceChannel = supabase
      .channel(`presence-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${otherUserId}`,
        },
        (payload) => {
          const updatedProfile = payload.new as {
            is_online?: boolean;
            last_seen?: string | null;
          };

          setOtherUserPresence({
            is_online: updatedProfile?.is_online ?? false,
            last_seen: updatedProfile?.last_seen ?? null,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (myUserId && userId) {
        setTypingStatus(String(userId), false);
      }
    };
  }, [myUserId, userId]);

  const markMessagesAsRead = async (
    currentUserId: string,
    otherUserId: string
  ) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      console.log('Error marcando leídos:', error.message);
      return;
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.sender_id === otherUserId && msg.receiver_id === currentUserId
          ? { ...msg, is_read: true }
          : msg
      )
    );
  };

  const loadChatData = async () => {
    try {
      setLoadingMessages(true);

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user || !userId) {
        setLoadingMessages(false);
        return;
      }

      const myId = userData.user.id;
      const otherId = String(userId);

      setMyUserId(myId);

      const [profileResult, followAResult, followBResult, messagesResult] =
        await Promise.all([
          supabase.from('profiles').select('coins').eq('id', myId).single(),
          supabase
            .from('follows')
            .select('id')
            .eq('follower_id', myId)
            .eq('following_id', otherId),
          supabase
            .from('follows')
            .select('id')
            .eq('follower_id', otherId)
            .eq('following_id', myId),
          supabase
            .from('messages')
            .select('*')
            .or(
              `and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`
            )
            .order('created_at', { ascending: false }),
        ]);

      if (!profileResult.error) {
        setCoins(profileResult.data?.coins || 0);
      }

      setIsMutual(
        !!followAResult.data?.length && !!followBResult.data?.length
      );

      if (messagesResult.error) {
        console.log('Error cargando mensajes:', messagesResult.error.message);
        return;
      }

      setMessages(messagesResult.data || []);

      await markMessagesAsRead(myId, otherId);
    } catch (error) {
      console.log('Error cargando chat:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadTypingStatus = async () => {
    if (!myUserId || !userId) return;

    const otherId = String(userId);

    const { data, error } = await supabase
      .from('typing_status')
      .select('*')
      .eq('user_id', otherId)
      .eq('chat_with_user_id', myUserId)
      .maybeSingle();

    if (error) {
      console.log('Error cargando typing status:', error.message);
      return;
    }

    setOtherUserTyping(!!data?.is_typing);
  };

  const loadOtherUserPresence = async () => {
    if (!userId) return;

    const otherId = String(userId);

    const { data, error } = await supabase
      .from('profiles')
      .select('is_online, last_seen')
      .eq('id', otherId)
      .single();

    if (error) {
      console.log('Error cargando presencia del usuario:', error.message);
      return;
    }

    setOtherUserPresence({
      is_online: data?.is_online ?? false,
      last_seen: data?.last_seen ?? null,
    });
  };

  const setTypingStatus = async (otherId: string, isTyping: boolean) => {
    if (!myUserId) return;

    const { error } = await supabase.from('typing_status').upsert(
      {
        user_id: myUserId,
        chat_with_user_id: otherId,
        is_typing: isTyping,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    if (error) {
      console.log('Error actualizando typing status:', error.message);
    }
  };

  const handleTextChange = async (value: string) => {
    setText(value);

    if (!myUserId || !userId) return;

    const otherId = String(userId);

    if (value.trim().length > 0) {
      setTypingStatus(otherId, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(otherId, false);
      }, 1200);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      setTypingStatus(otherId, false);
    }
  };

  const handleSend = async () => {
    const messageText = text.trim();

    if (!messageText) return;
    if (!myUserId || !userId) return;
    if (sending) return;

    try {
      setSending(true);

      const otherId = String(userId);

      if (!isMutual && coins < 1) {
        Alert.alert(
          'Sin monedas',
          'Necesitás al menos 1 moneda para enviar este mensaje.'
        );
        return;
      }

      if (!isMutual) {
        const newCoins = coins - 1;

        const { error: coinError } = await supabase
          .from('profiles')
          .update({ coins: newCoins })
          .eq('id', myUserId);

        if (coinError) {
          Alert.alert('Error', coinError.message);
          return;
        }

        setCoins(newCoins);
      }

      setText('');
      await setTypingStatus(otherId, false);

      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: myUserId,
            receiver_id: otherId,
            content: messageText,
            is_read: false,
          },
        ])
        .select()
        .single();

      if (error) {
        setText(messageText);
        Alert.alert('Error', error.message);
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === data.id);
        if (exists) return prev;
        return [data, ...prev];
      });

      await createMessageNotification({
        userId: otherId,
        actorId: myUserId,
        relatedUserId: myUserId,
        relatedMessageId: data.id,
      });
    } catch {
      setText(messageText);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const formatHour = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLastSeen = (dateString?: string | null) => {
    if (!dateString) return 'Última vez hace un momento';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60000) return 'Última vez hace un momento';

    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) return `Última vez hace ${diffMinutes} min`;

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `Última vez hace ${diffHours} h`;

    const diffDays = Math.floor(diffMs / 86400000);
    return `Última vez hace ${diffDays} d`;
  };

  const getHeaderStatusText = () => {
    if (otherUserTyping) return 'Escribiendo...';

    if (otherUserPresence?.is_online) return 'En línea';

    if (otherUserPresence?.last_seen) {
      return formatLastSeen(otherUserPresence.last_seen);
    }

    return isMutual
      ? 'Mensajes gratis'
      : `Cada mensaje cuesta 1 moneda · Tenés ${coins}`;
  };

  const renderEmptyState = () => {
    if (loadingMessages) return null;

    return (
      <View style={styles.centerState}>
        <View style={styles.uninvertedContent}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>Empezá la conversación</Text>
            <Text style={styles.emptyText}>
              Todavía no hay mensajes. Mandá el primero.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.sender_id === myUserId;

    return (
      <View
        style={[
          styles.messageWrapper,
          mine ? styles.myWrapper : styles.theirWrapper,
        ]}
      >
        <View style={[styles.message, mine ? styles.myMessage : styles.theirMessage]}>
          <Text style={styles.messageText}>{item.content}</Text>

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, mine && styles.myMessageTime]}>
              {formatHour(item.created_at)}
            </Text>

            {mine && (
              <Ionicons
                name={item.is_read ? 'checkmark-done' : 'checkmark'}
                size={15}
                color={item.is_read ? GOLD_LIGHT : '#F6E7C7'}
                style={styles.checkIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ImageBackground
        source={{ uri: chatBackground }}
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.container}>
              <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                  <Ionicons name="chevron-back" size={25} color={GOLD_LIGHT} />
                </Pressable>

                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {String(username || 'U').charAt(0).toUpperCase()}
                  </Text>

                  {otherUserPresence?.is_online && <View style={styles.onlineDot} />}
                </View>

                <View style={styles.headerTextBox}>
                  <Text style={styles.title} numberOfLines={1}>
                    {username || 'Usuario'}
                  </Text>

                  <Text
                    style={[
                      styles.info,
                      otherUserPresence?.is_online && styles.onlineInfo,
                      otherUserTyping && styles.typingInfo,
                    ]}
                    numberOfLines={1}
                  >
                    {getHeaderStatusText()}
                  </Text>
                </View>

                <View style={styles.headerAction}>
                  <Ionicons name="call-outline" size={21} color={GOLD_LIGHT} />
                </View>
              </View>

              {loadingMessages ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={GOLD} />
                  <Text style={styles.loadingText}>Cargando mensajes...</Text>
                </View>
              ) : (
                <FlatList
                  data={messages}
                  keyExtractor={(item) => item.id.toString()}
                  inverted
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.messagesContainer}
                  ListEmptyComponent={renderEmptyState()}
                  renderItem={renderMessage}
                  showsVerticalScrollIndicator={false}
                />
              )}

              {!isMutual && (
                <View style={styles.coinNotice}>
                  <Ionicons name="diamond-outline" size={16} color={GOLD_LIGHT} />
                  <Text style={styles.coinNoticeText}>
                    Mensaje: 1 moneda · Tenés {coins}
                  </Text>
                </View>
              )}

              <View style={styles.inputArea}>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Escribí un mensaje..."
                    placeholderTextColor="#8E8E8E"
                    value={text}
                    onChangeText={handleTextChange}
                    multiline
                    textAlignVertical="top"
                    returnKeyType="default"
                  />

                  <Pressable
                    style={[
                      styles.sendButton,
                      (!text.trim() || sending) && styles.disabledButton,
                    ]}
                    onPress={handleSend}
                    disabled={!text.trim() || sending}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#111111" />
                    ) : (
                      <Ionicons name="send" size={18} color="#111111" />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const GOLD = '#D9A85C';
const GOLD_LIGHT = '#FFD38A';
const BG = '#07090D';
const CARD = '#111318';
const CARD_SOFT = '#171A21';
const BORDER = '#2B2116';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  background: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 13, 0.92)',
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 19, 24, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_SOFT,
    marginRight: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1C1710',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  userAvatarText: {
    color: GOLD_LIGHT,
    fontSize: 18,
    fontWeight: '900',
  },
  onlineDot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#44D17A',
    right: 0,
    bottom: 1,
    borderWidth: 2,
    borderColor: CARD,
  },
  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  info: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    minHeight: 17,
  },
  onlineInfo: {
    color: '#44D17A',
  },
  typingInfo: {
    color: GOLD_LIGHT,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18120B',
    borderWidth: 1,
    borderColor: '#5A3D1D',
    marginLeft: 8,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#B8B8B8',
    marginTop: 12,
    fontSize: 14,
  },
  messagesContainer: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexGrow: 1,
  },
  messageWrapper: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  myWrapper: {
    justifyContent: 'flex-end',
  },
  theirWrapper: {
    justifyContent: 'flex-start',
  },
  message: {
    maxWidth: '80%',
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  myMessage: {
    backgroundColor: GOLD,
    borderColor: GOLD_LIGHT,
    borderBottomRightRadius: 5,
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  theirMessage: {
    backgroundColor: 'rgba(17, 19, 24, 0.97)',
    borderColor: BORDER,
    borderBottomLeftRadius: 5,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
  messageFooter: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  messageTime: {
    color: '#A9A9A9',
    fontSize: 11,
    fontWeight: '600',
  },
  myMessageTime: {
    color: '#1B1309',
  },
  checkIcon: {
    marginLeft: 4,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 30,
  },
  uninvertedContent: {
    transform: [{ scaleY: -1 }],
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 19, 24, 0.95)',
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: BORDER,
    width: 280,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptyText: {
    color: '#B8B8B8',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  coinNotice: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#18120B',
    borderWidth: 1,
    borderColor: '#5A3D1D',
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinNoticeText: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 7,
  },
  inputArea: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 18 : 24,
    backgroundColor: 'rgba(7, 9, 13, 0.98)',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 42,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 9,
    paddingRight: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  disabledButton: {
    backgroundColor: '#2A2D35',
    opacity: 0.75,
    shadowOpacity: 0,
  },
});