import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type FollowMode = 'followers' | 'following';

type FollowRow = {
  follower_id?: string;
  following_id?: string;
};

type ProfileItem = {
  id: string;
  username: string;
  avatar_url?: string | null;
  is_online?: boolean;
  last_seen?: string | null;
};

export default function FollowListScreen() {
  const params = useLocalSearchParams<{
    userId: string;
    mode: FollowMode;
    title?: string;
  }>();

  const userId = params.userId;
  const mode = (params.mode as FollowMode) || 'followers';
  const screenTitle =
    params.title || (mode === 'followers' ? 'Seguidores' : 'Siguiendo');

  const [myUserId, setMyUserId] = useState('');
  const [users, setUsers] = useState<ProfileItem[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadAll();
  }, [userId, mode]);

  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    if (!q) return users;

    return users.filter((user) => {
      const nameMatch = user.username?.toLowerCase().includes(q);
      const idMatch = user.id?.toLowerCase().includes(q);
      return nameMatch || idMatch;
    });
  }, [users, searchText]);

  const loadAll = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData.user;

      if (!currentUser) {
        router.replace('/login');
        return;
      }

      setMyUserId(currentUser.id);

      const { data: followRows, error: followError } = await supabase
        .from('follows')
        .select(mode === 'followers' ? 'follower_id' : 'following_id')
        .eq(mode === 'followers' ? 'following_id' : 'follower_id', userId);

      if (followError) {
        console.log('Error cargando follows:', followError.message);
        return;
      }

      const ids =
        mode === 'followers'
          ? (followRows as FollowRow[])
              .map((row) => row.follower_id)
              .filter(Boolean)
          : (followRows as FollowRow[])
              .map((row) => row.following_id)
              .filter(Boolean);

      if (!ids.length) {
        setUsers([]);
      } else {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_online, last_seen')
          .in('id', ids as string[]);

        if (profilesError) {
          console.log('Error cargando perfiles:', profilesError.message);
          return;
        }

        const profiles = (profilesData || []) as ProfileItem[];

        const orderedProfiles = (ids as string[])
          .map((id) => profiles.find((p) => p.id === id))
          .filter(Boolean) as ProfileItem[];

        setUsers(orderedProfiles);
      }

      const { data: myFollowingData, error: myFollowingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id);

      if (myFollowingError) {
        console.log('Error cargando mis seguidos:', myFollowingError.message);
        return;
      }

      setFollowingIds((myFollowingData || []).map((row) => row.following_id));
    } catch (error) {
      console.log('Error inesperado cargando lista:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!myUserId || !targetUserId || myUserId === targetUserId) return;

    try {
      setActionLoadingId(targetUserId);

      const isFollowing = followingIds.includes(targetUserId);

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', myUserId)
          .eq('following_id', targetUserId);

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        setFollowingIds((prev) => prev.filter((id) => id !== targetUserId));

        if (mode === 'following' && userId === myUserId) {
          setUsers((prev) => prev.filter((user) => user.id !== targetUserId));
        }
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: myUserId,
          following_id: targetUserId,
        });

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        setFollowingIds((prev) => [...prev, targetUserId]);
      }
    } catch (error) {
      console.log('Error siguiendo/dejando de seguir:', error);
      Alert.alert('Error', 'No se pudo actualizar');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getAvatarLetter = (username: string) =>
    username?.charAt(0)?.toUpperCase() || 'U';

  const formatPresence = (user: ProfileItem) => {
    if (user.is_online) return '🟢 En línea';
    if (!user.last_seen) return 'Activo recientemente';

    const date = new Date(user.last_seen);
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

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.back}>← Volver</Text>
      </Pressable>

      <Text style={styles.title}>{screenTitle}</Text>

      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        placeholder={`Buscar en ${screenTitle.toLowerCase()} por nombre o ID`}
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchText.trim()
                ? 'No se encontraron usuarios.'
                : mode === 'followers'
                ? 'Todavía no hay seguidores.'
                : 'Todavía no seguís a nadie.'}
            </Text>
          }
          renderItem={({ item }) => {
            const isFollowing = followingIds.includes(item.id);
            const showFollowButton = item.id !== myUserId;

            return (
              <View style={styles.card}>
                <Pressable
                  style={styles.left}
                  onPress={() =>
                    router.push({
                      pathname: '/user-profile',
                      params: { userId: item.id },
                    })
                  }
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarText}>
                        {getAvatarLetter(item.username)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.info}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.userId} numberOfLines={1}>
                      ID: {item.id}
                    </Text>
                    <Text
                      style={[
                        styles.presence,
                        item.is_online && styles.presenceOnline,
                      ]}
                    >
                      {formatPresence(item)}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable
                    style={styles.chatButton}
                    onPress={() =>
                      router.push({
                        pathname: '/chat',
                        params: {
                          userId: item.id,
                          username: item.username,
                        },
                      })
                    }
                  >
                    <Text style={styles.chatButtonText}>Chat</Text>
                  </Pressable>

                  {showFollowButton && (
                    <Pressable
                      style={[
                        styles.followButton,
                        isFollowing && styles.followingButton,
                        actionLoadingId === item.id && styles.disabledButton,
                      ]}
                      onPress={() => handleToggleFollow(item.id)}
                      disabled={actionLoadingId === item.id}
                    >
                      <Text style={styles.followButtonText}>
                        {actionLoadingId === item.id
                          ? '...'
                          : isFollowing
                          ? 'Dejar'
                          : 'Seguir'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    padding: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  back: {
    color: '#a78bfa',
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 14,
  },
  searchInput: {
    backgroundColor: '#12182a',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#1f2940',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 14,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 10,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#12182a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2940',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 12,
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 12,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  userId: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  presence: {
    color: '#94a3b8',
    fontSize: 12,
  },
  presenceOnline: {
    color: '#4ade80',
    fontWeight: '700',
  },
  actions: {
    width: 78,
    gap: 8,
  },
  chatButton: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  followButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#374151',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
});