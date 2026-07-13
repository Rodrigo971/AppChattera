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

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir de Chattera?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/login');
            } catch (error) {
              console.log('Error cerrando sesión:', error);
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          },
        },
      ]
    );
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
        <ActivityIndicator size="large" color="#D9A85C" />
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
          <>
            <View style={styles.ownProfileBadge}>
              <Text style={styles.ownProfileBadgeText}>Este es tu perfil</Text>
            </View>

            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090D',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  loading: {
    flex: 1,
    backgroundColor: '#07090D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#B8A37A',
    fontSize: 14,
    marginTop: 12,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  back: {
    color: '#FFD38A',
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#10131A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2B2418',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#D9A85C',
  },
  avatarFallback: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#17120B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#D9A85C',
  },
  avatarLetter: {
    color: '#FFD38A',
    fontSize: 46,
    fontWeight: '900',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  presence: {
    color: '#B8A37A',
    fontSize: 14,
    marginBottom: 14,
  },
  presenceOnline: {
    color: '#4ADE80',
    fontWeight: '800',
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0B0D12',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2B2418',
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFD38A',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#B8A37A',
    fontSize: 13,
    fontWeight: '700',
  },
  userIdBox: {
    width: '100%',
    backgroundColor: '#0B0D12',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2B2418',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userIdInfo: {
    flex: 1,
    paddingRight: 10,
  },
  userIdLabel: {
    color: '#B8A37A',
    fontSize: 13,
    marginBottom: 4,
  },
  userIdValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  copyButton: {
    backgroundColor: '#D9A85C',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  copyButtonText: {
    color: '#17120B',
    fontSize: 13,
    fontWeight: '900',
  },
  bio: {
    color: '#E5E0D6',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 22,
  },
  bioEmpty: {
    color: '#756B5A',
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
    backgroundColor: '#D9A85C',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  followingButton: {
    backgroundColor: '#2A241A',
  },
  followButtonText: {
    color: '#17120B',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
  },
  messageButton: {
    backgroundColor: '#17120B',
    borderWidth: 1,
    borderColor: '#D9A85C',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  messageButtonText: {
    color: '#FFD38A',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  ownProfileBadge: {
    backgroundColor: '#17120B',
    borderWidth: 1,
    borderColor: '#2B2418',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 180,
    marginBottom: 12,
  },
  ownProfileBadgeText: {
    color: '#FFD38A',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
  },
  logoutButton: {
    width: '100%',
    backgroundColor: '#1A0F0F',
    borderWidth: 1,
    borderColor: '#D9A85C',
    borderRadius: 16,
    paddingVertical: 15,
  },
  logoutButtonText: {
    color: '#FFD38A',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
  },
});