import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    createFollowNotificationOnce,
    createProfileViewNotificationOnce,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';


type ProfileData = {
  id: string;
  username: string;
  bio?: string | null;
  avatar_url?: string | null;
  is_online?: boolean;
  last_seen?: string | null;
};

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [myUserId, setMyUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const registerProfileView = async (viewerId: string, viewedUserId: string) => {
  try {
    if (!viewerId || !viewedUserId || viewerId === viewedUserId) return;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: existingView, error: existingError } = await supabase
      .from('profile_views')
      .select('id')
      .eq('viewer_id', viewerId)
      .eq('viewed_user_id', viewedUserId)
      .gte('created_at', tenMinutesAgo)
      .maybeSingle();

    if (existingError) {
      console.log('Error verificando visita previa:', existingError.message);
      return;
    }

    if (!existingView) {
      const { error: insertError } = await supabase.from('profile_views').insert({
        viewer_id: viewerId,
        viewed_user_id: viewedUserId,
      });

      if (insertError) {
        console.log('Error registrando visita al perfil:', insertError.message);
        return;
      }
    }

    await createProfileViewNotificationOnce({
      userId: viewedUserId,
      actorId: viewerId,
      relatedUserId: viewerId,
    });
  } catch (error) {
    console.log('Error inesperado registrando visita:', error);
  }
};

  const loadFollowStats = async (targetUserId: string, currentUserId: string) => {
    try {
      const [
        { count: followers },
        { count: following },
        { data: followRow, error: followCheckError },
      ] = await Promise.all([
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetUserId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', targetUserId),
        supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId)
          .maybeSingle(),
      ]);

      if (followCheckError) {
        console.log('Error revisando follow:', followCheckError.message);
      }

      setFollowersCount(followers ?? 0);
      setFollowingCount(following ?? 0);
      setIsFollowing(!!followRow);
    } catch (error) {
      console.log('Error cargando seguidores/seguidos:', error);
    }
  };

  const loadProfile = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.log('Error obteniendo usuario actual:', authError.message);
        return;
      }

      const currentUser = authData.user;

      if (!currentUser) {
        router.replace('/login');
        return;
      }

      setMyUserId(currentUser.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_url, is_online, last_seen')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Error cargando perfil del usuario:', error.message);
        return;
      }

      setProfile(data);

      await loadFollowStats(userId, currentUser.id);

      if (currentUser.id !== userId) {
        await registerProfileView(currentUser.id, userId);
      }
    } catch (error) {
      console.log('Error inesperado cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleCopyUserId = async () => {
    if (!profile?.id) return;

    try {
      await Clipboard.setStringAsync(profile.id);
      Alert.alert('Listo', 'ID copiado');
    } catch (error) {
      console.log('Error copiando ID:', error);
      Alert.alert('Error', 'No se pudo copiar el ID');
    }
  };

  const handleToggleFollow = async () => {
    if (!profile?.id || !myUserId || myUserId === profile.id) return;

    try {
      setFollowLoading(true);

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', myUserId)
          .eq('following_id', profile.id);

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: myUserId,
          following_id: profile.id,
        });

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);

        await createFollowNotificationOnce({
  userId: profile.id,
  actorId: myUserId,
  relatedUserId: myUserId,
});
      }
    } catch (error) {
      console.log('Error siguiendo/dejando de seguir:', error);
      Alert.alert('Error', 'No se pudo actualizar el seguimiento');
    } finally {
      setFollowLoading(false);
    }
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

  const presenceText = profile?.is_online
    ? '🟢 En línea'
    : formatLastSeen(profile?.last_seen);

  const isMyOwnProfile = !!profile && myUserId === profile.id;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyText}>No se pudo cargar el perfil.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.back}>← Volver</Text>
      </Pressable>

      <View style={styles.card}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarLetter}>
              {profile.username?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}

        <Text style={styles.username}>{profile.username}</Text>

        <Text
          style={[
            styles.presence,
            profile.is_online && styles.presenceOnline,
          ]}
        >
          {presenceText}
        </Text>

        <View style={styles.statsRow}>
          <Pressable
            style={styles.statBox}
            onPress={() =>
              router.push({
                pathname: '/follow-list',
                params: {
                  userId: profile.id,
                  mode: 'followers',
                  title: 'Seguidores',
                },
              })
            }
          >
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Seguidores</Text>
          </Pressable>

          <Pressable
            style={styles.statBox}
            onPress={() =>
              router.push({
                pathname: '/follow-list',
                params: {
                  userId: profile.id,
                  mode: 'following',
                  title: 'Siguiendo',
                },
              })
            }
          >
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Siguiendo</Text>
          </Pressable>
        </View>

        <View style={styles.userIdBox}>
          <View style={styles.userIdInfo}>
            <Text style={styles.userIdLabel}>ID de usuario</Text>
            <Text style={styles.userIdValue} numberOfLines={1}>
              {profile.id}
            </Text>
          </View>

          <Pressable style={styles.copyButton} onPress={handleCopyUserId}>
            <Text style={styles.copyButtonText}>Copiar</Text>
          </Pressable>
        </View>

        {!!profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.bioEmpty}>Este usuario todavía no agregó bio.</Text>
        )}

        {!isMyOwnProfile && (
          <View style={styles.actionsRow}>
            <Pressable
              style={[
                styles.followButton,
                isFollowing && styles.followingButton,
                followLoading && styles.buttonDisabled,
              ]}
              onPress={handleToggleFollow}
              disabled={followLoading}
            >
              <Text style={styles.followButtonText}>
                {followLoading
                  ? 'Cargando...'
                  : isFollowing
                  ? 'Siguiendo'
                  : 'Seguir'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.messageButton}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: {
                    userId: profile.id,
                    username: profile.username,
                  },
                })
              }
            >
              <Text style={styles.messageButtonText}>Enviar mensaje</Text>
            </Pressable>
          </View>
        )}

        {isMyOwnProfile && (
          <View style={styles.ownProfileBadge}>
            <Text style={styles.ownProfileBadgeText}>Este es tu perfil</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  loading: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  back: {
    color: '#a78bfa',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#12182a',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2940',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 16,
  },
  avatarFallback: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 46,
    fontWeight: '800',
  },
  username: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  presence: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 14,
  },
  presenceOnline: {
    color: '#4ade80',
    fontWeight: '700',
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0f1424',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#232d45',
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  userIdBox: {
    width: '100%',
    backgroundColor: '#0f1424',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#232d45',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userIdInfo: {
    flex: 1,
    paddingRight: 10,
  },
  userIdLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  userIdValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  copyButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  bio: {
    color: '#d1d5db',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 22,
  },
  bioEmpty: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
    fontStyle: 'italic',
  },
  actionsRow: {
    width: '100%',
    gap: 10,
  },
  followButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  followingButton: {
    backgroundColor: '#374151',
  },
  followButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },
  messageButton: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  messageButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  ownProfileBadge: {
    backgroundColor: '#1b2338',
    borderWidth: 1,
    borderColor: '#2b3550',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 180,
  },
  ownProfileBadgeText: {
    color: '#c4b5fd',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
});