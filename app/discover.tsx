import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createFollowNotificationOnce } from '../lib/notifications';
import { supabase } from '../lib/supabase';


type Profile = {
  id: string;
  username: string;
  coins: number;
  avatar_url?: string | null;
  is_online?: boolean;
  last_seen?: string;
};

export default function DiscoverScreen() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [myUserId, setMyUserId] = useState<string>('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setMyUserId(userData.user.id);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, coins, avatar_url, is_online, last_seen')
      .neq('id', userData.user.id);

    const sortedUsers = (profilesData || []).sort((a, b) => {
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;

      const dateA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const dateB = b.last_seen ? new Date(b.last_seen).getTime() : 0;

      return dateB - dateA;
    });

    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userData.user.id);

    const { data: followersData } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userData.user.id);

    setUsers(sortedUsers);
    setFollowingIds((followingData || []).map((i) => i.following_id));
    setFollowerIds((followersData || []).map((i) => i.follower_id));
  };

  const handleFollow = async (targetUserId: string) => {
    const isFollowing = followingIds.includes(targetUserId);

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', myUserId)
        .eq('following_id', targetUserId);
        await createFollowNotificationOnce({
  userId: targetUserId,
  actorId: myUserId,
  relatedUserId: myUserId,
});

      setFollowingIds((prev) => prev.filter((id) => id !== targetUserId));
      return;
    }

    await supabase.from('follows').insert({
      follower_id: myUserId,
      following_id: targetUserId,
    });
await supabase.from('follows').insert({
  follower_id: myUserId,
  following_id: targetUserId,
});

setFollowingIds((prev) => [...prev, targetUserId]);

await createFollowNotificationOnce({
  userId: targetUserId,
  actorId: myUserId,
  relatedUserId: myUserId,
});
    setFollowingIds((prev) => [...prev, targetUserId]);
  };

  const getAvatarLetter = (username: string) =>
    username?.charAt(0)?.toUpperCase() || 'U';

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Desconectado';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `Hace ${diffMin} min`;

    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 24) return `Hace ${diffH} h`;

    const diffD = Math.floor(diffMs / 86400000);
    return `Hace ${diffD} d`;
  };

  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    if (!q) return users;

    return users.filter((user) => {
      const usernameMatch = user.username?.toLowerCase().includes(q);
      const idMatch = user.id?.toLowerCase().includes(q);
      return usernameMatch || idMatch;
    });
  }, [users, searchText]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Descubrir personas</Text>

      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Buscar por nombre o ID de usuario"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No se encontraron usuarios con ese nombre o ID.
          </Text>
        }
        renderItem={({ item }) => {
          const isFollowing = followingIds.includes(item.id);
          const followsMe = followerIds.includes(item.id);
          const isMutual = isFollowing && followsMe;

          return (
            <View style={styles.card}>
              <Pressable
                style={styles.avatarWrapper}
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

                {item.is_online && <View style={styles.onlineDot} />}
              </Pressable>

              <View style={styles.info}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/user-profile',
                      params: { userId: item.id },
                    })
                  }
                >
                  <Text style={styles.name}>{item.username}</Text>
                </Pressable>

                <Text style={styles.userId} numberOfLines={1}>
                  ID: {item.id}
                </Text>

                <Text style={styles.coins}>💰 {item.coins}</Text>

                {item.is_online ? (
                  <Text style={styles.online}>🟢 En línea</Text>
                ) : (
                  <Text style={styles.offline}>
                    {formatLastSeen(item.last_seen)}
                  </Text>
                )}

                {isMutual && <Text style={styles.mutual}>Se siguen</Text>}
                {!isMutual && followsMe && (
                  <Text style={styles.followsMe}>Te sigue</Text>
                )}
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.followBtn,
                    isFollowing && styles.followingBtn,
                  ]}
                  onPress={() => handleFollow(item.id)}
                >
                  <Text style={styles.btnText}>
                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.chatBtn}
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
                  <Text style={styles.btnText}>Chat</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 16,
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
  card: {
    flexDirection: 'row',
    backgroundColor: '#12182a',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2940',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#12182a',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  userId: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  coins: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  online: {
    color: '#4ade80',
    fontSize: 12,
  },
  offline: {
    color: '#6b7280',
    fontSize: 12,
  },
  mutual: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  followsMe: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    width: 90,
  },
  followBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: '#374151',
  },
  chatBtn: {
    backgroundColor: '#1f2937',
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 14,
  },
});