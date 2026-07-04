import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type MessageRow = {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

type Profile = {
  id: string;
  username: string;
  avatar_url?: string | null;
  is_online?: boolean;
  last_seen?: string | null;
};

type ConversationItem = {
  userId: string;
  username: string;
  avatar_url?: string | null;
  lastMessage: string;
  created_at: string;
  sentByMe: boolean;
  unreadCount: number;
};

type PresenceMap = Record<
  string,
  {
    is_online?: boolean;
    last_seen?: string | null;
  }
>;

export default function ChatsScreen() {
  const [myUserId, setMyUserId] = useState('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [avatarsMap, setAvatarsMap] = useState<Record<string, string | null>>({});
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const openUserProfile = (userId: string) => {
    router.push({
      pathname: '/user-profile',
      params: { userId },
    });
  };

  const openChat = (userId: string, username: string) => {
    router.push({
      pathname: '/chat',
      params: {
        userId,
        username,
      },
    });
  };

  const loadMissingProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, is_online, last_seen')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfilesMap((prev) => ({
        ...prev,
        [data.id]: data.username,
      }));

      setAvatarsMap((prev) => ({
        ...prev,
        [data.id]: data.avatar_url ?? null,
      }));

      setPresenceMap((prev) => ({
        ...prev,
        [data.id]: {
          is_online: data.is_online ?? false,
          last_seen: data.last_seen ?? null,
        },
      }));
    }
  };

  const loadChats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setLoading(false);
        return;
      }

      const myId = userData.user.id;
      setMyUserId(myId);

      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error cargando chats:', error.message);
        return;
      }

      const allMessages = msgs || [];
      setMessages(allMessages);

      const otherUserIds = Array.from(
        new Set(
          allMessages.map((msg) =>
            msg.sender_id === myId ? msg.receiver_id : msg.sender_id
          )
        )
      );

      if (otherUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_online, last_seen')
          .in('id', otherUserIds);

        if (!profilesError && profilesData) {
          const usernameMap: Record<string, string> = {};
          const avatarMap: Record<string, string | null> = {};
          const newPresenceMap: PresenceMap = {};

          profilesData.forEach((profile: Profile) => {
            usernameMap[profile.id] = profile.username;
            avatarMap[profile.id] = profile.avatar_url ?? null;
            newPresenceMap[profile.id] = {
              is_online: profile.is_online ?? false,
              last_seen: profile.last_seen ?? null,
            };
          });

          setProfilesMap(usernameMap);
          setAvatarsMap(avatarMap);
          setPresenceMap(newPresenceMap);
        }
      } else {
        setProfilesMap({});
        setAvatarsMap({});
        setPresenceMap({});
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats(true);
  };

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useFocusEffect(
    useCallback(() => {
      loadChats(true);
    }, [loadChats])
  );

  useEffect(() => {
    if (!myUserId) return;

    const channel = supabase
      .channel(`conversations-${myUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as MessageRow;

          const belongsToMe =
            newMessage.sender_id === myUserId ||
            newMessage.receiver_id === myUserId;

          if (!belongsToMe) return;

          setMessages((prev) => {
            const exists = prev.some((msg) => msg.id === newMessage.id);
            if (exists) return prev;
            return [newMessage, ...prev];
          });

          const otherUserId =
            newMessage.sender_id === myUserId
              ? newMessage.receiver_id
              : newMessage.sender_id;

          if (!profilesMap[otherUserId]) {
            await loadMissingProfile(otherUserId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMessage = payload.new as MessageRow;

          const belongsToMe =
            updatedMessage.sender_id === myUserId ||
            updatedMessage.receiver_id === myUserId;

          if (!belongsToMe) return;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId, profilesMap]);

  useEffect(() => {
    if (!myUserId) return;

    const presenceChannel = supabase
      .channel(`profiles-presence-${myUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;

          if (!updatedProfile?.id || updatedProfile.id === myUserId) return;
          if (!(updatedProfile.id in profilesMap)) return;

          setPresenceMap((prev) => ({
            ...prev,
            [updatedProfile.id]: {
              is_online: updatedProfile.is_online ?? false,
              last_seen: updatedProfile.last_seen ?? null,
            },
          }));

          if (updatedProfile.username) {
            setProfilesMap((prev) => ({
              ...prev,
              [updatedProfile.id]: updatedProfile.username,
            }));
          }

          setAvatarsMap((prev) => ({
            ...prev,
            [updatedProfile.id]:
              updatedProfile.avatar_url ?? prev[updatedProfile.id] ?? null,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [myUserId, profilesMap]);

  const conversations = useMemo(() => {
    if (!myUserId) return [];

    const map = new Map<string, ConversationItem>();

    for (const msg of messages) {
      const otherUserId =
        msg.sender_id === myUserId ? msg.receiver_id : msg.sender_id;

      if (!map.has(otherUserId)) {
        map.set(otherUserId, {
          userId: otherUserId,
          username: profilesMap[otherUserId] || 'Usuario',
          avatar_url: avatarsMap[otherUserId] ?? null,
          lastMessage: msg.content,
          created_at: msg.created_at,
          sentByMe: msg.sender_id === myUserId,
          unreadCount: 0,
        });
      }

      const current = map.get(otherUserId)!;

      if (
        msg.receiver_id === myUserId &&
        msg.sender_id === otherUserId &&
        msg.is_read === false
      ) {
        current.unreadCount += 1;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [messages, myUserId, profilesMap, avatarsMap]);

  const totalUnread = conversations.reduce(
    (sum, item) => sum + item.unreadCount,
    0
  );

  const formatHour = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLastSeen = (dateString?: string | null) => {
    if (!dateString) return 'Activo recientemente';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60000) return 'Activo ahora';

    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    const diffDays = Math.floor(diffMs / 86400000);
    return `Hace ${diffDays} d`;
  };

  const getPresenceText = (userId: string) => {
    const presence = presenceMap[userId];

    if (presence?.is_online) return 'En línea';
    if (presence?.last_seen) return formatLastSeen(presence.last_seen);
    return 'Activo recientemente';
  };

  const getAvatarLetter = (username: string) => {
    return username?.trim()?.charAt(0)?.toUpperCase() || 'U';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topGlow} />

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Chats</Text>
            <Text style={styles.subtitle}>
              {conversations.length > 0
                ? `${conversations.length} conversación${
                    conversations.length === 1 ? '' : 'es'
                  }`
                : 'Tus conversaciones recientes'}
            </Text>
          </View>

          <View style={styles.headerIconBox}>
            <Ionicons name="chatbubbles-outline" size={23} color={GOLD_LIGHT} />

            {totalUnread > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.searchFakeBox}>
          <Ionicons name="search" size={18} color="#8F8F8F" />
          <Text style={styles.searchFakeText}>Buscar conversaciones</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={styles.loadingText}>Cargando chats...</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.userId}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={GOLD}
                colors={[GOLD]}
              />
            }
            contentContainerStyle={
              conversations.length === 0
                ? styles.emptyContainer
                : styles.listContent
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={34}
                    color={GOLD_LIGHT}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  Todavía no tenés conversaciones
                </Text>

                <Text style={styles.emptyText}>
                  Cuando empieces a hablar con alguien, tus chats aparecerán acá.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const presenceText = getPresenceText(item.userId);
              const isOnline = presenceMap[item.userId]?.is_online;
              const hasUnread = item.unreadCount > 0;

              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.chatCard,
                    hasUnread && styles.chatCardUnread,
                    pressed && styles.chatCardPressed,
                  ]}
                  onPress={() => openChat(item.userId, item.username)}
                >
                  <Pressable
                    style={styles.avatarWrapper}
                    onPress={() => openUserProfile(item.userId)}
                    hitSlop={8}
                  >
                    <View style={styles.avatarOuter}>
                      <View style={styles.avatar}>
                        {item.avatar_url ? (
                          <Image
                            source={{ uri: item.avatar_url }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <Text style={styles.avatarText}>
                            {getAvatarLetter(item.username)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View
                      style={[
                        styles.statusDot,
                        isOnline ? styles.onlineDot : styles.offlineDot,
                      ]}
                    />
                  </Pressable>

                  <View style={styles.chatInfo}>
                    <View style={styles.topRow}>
                      <Text
                        style={[
                          styles.username,
                          hasUnread && styles.usernameUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {item.username}
                      </Text>

                      <Text
                        style={[styles.time, hasUnread && styles.timeUnread]}
                      >
                        {formatHour(item.created_at)}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.presenceText,
                        isOnline && styles.onlineText,
                      ]}
                      numberOfLines={1}
                    >
                      {isOnline ? 'En línea ahora' : presenceText}
                    </Text>

                    <View style={styles.bottomRow}>
                      <Text
                        style={[
                          styles.lastMessage,
                          hasUnread && styles.unreadMessage,
                        ]}
                        numberOfLines={1}
                      >
                        {item.sentByMe ? 'Tú: ' : ''}
                        {item.lastMessage}
                      </Text>

                      {hasUnread ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {item.unreadCount > 99 ? '99+' : item.unreadCount}
                          </Text>
                        </View>
                      ) : (
                        item.sentByMe && (
                          <Ionicons
                            name="checkmark-done"
                            size={17}
                            color="#777"
                          />
                        )
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
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
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  topGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(217, 168, 92, 0.13)',
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#B8B8B8',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#18120B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5A3D1D',
    position: 'relative',
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#FF5C5C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: BG,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  searchFakeBox: {
    marginHorizontal: 18,
    marginBottom: 14,
    height: 48,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchFakeText: {
    color: '#8F8F8F',
    fontSize: 14,
    marginLeft: 9,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chatCardUnread: {
    borderColor: GOLD,
    backgroundColor: '#17120B',
    shadowColor: GOLD,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  chatCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarOuter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#1C1710',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GOLD,
  },
  avatar: {
    width: 53,
    height: 53,
    borderRadius: 27,
    backgroundColor: '#18120B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#5A3D1D',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  avatarText: {
    color: GOLD_LIGHT,
    fontSize: 19,
    fontWeight: '900',
  },
  statusDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    position: 'absolute',
    right: 2,
    bottom: 3,
    borderWidth: 2,
    borderColor: CARD,
  },
  onlineDot: {
    backgroundColor: '#44D17A',
  },
  offlineDot: {
    backgroundColor: '#64748B',
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
  },
  usernameUnread: {
    color: GOLD_LIGHT,
  },
  time: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  timeUnread: {
    color: GOLD_LIGHT,
  },
  presenceText: {
    color: '#8F8F8F',
    fontSize: 12,
    marginBottom: 7,
    fontWeight: '600',
  },
  onlineText: {
    color: '#44D17A',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    color: '#B8B8B8',
    fontSize: 14,
    paddingRight: 10,
    fontWeight: '500',
  },
  unreadMessage: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  badge: {
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    marginLeft: 8,
  },
  badgeText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '900',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 26,
    paddingVertical: 30,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18120B',
    borderWidth: 1,
    borderColor: '#5A3D1D',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#9A9A9A',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});