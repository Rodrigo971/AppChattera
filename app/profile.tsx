import { useFocusEffect } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type ProfileRow = {
  username?: string | null;
  coins?: number | null;
  avatar_url?: string | null;
  bio?: string | null;
};

type ProfileViewItem = {
  id: number;
  viewer_id: string;
  viewed_user_id: string;
  created_at: string;
};

type ViewerProfile = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
};

type VisitCardItem = {
  id: number;
  created_at: string;
  viewer_id: string;
  username: string;
  avatar_url?: string | null;
};

export default function ProfileScreen() {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coins, setCoins] = useState(0);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [profileVisits, setProfileVisits] = useState<VisitCardItem[]>([]);
  const [visitsCount, setVisitsCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingVisits, setLoadingVisits] = useState(false);

  const loadFollowStats = async (myUserId: string) => {
    try {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', myUserId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', myUserId),
      ]);

      setFollowersCount(followers ?? 0);
      setFollowingCount(following ?? 0);
    } catch (error) {
      console.log('Error cargando seguidores/seguidos:', error);
    }
  };

  const loadProfileViews = async (myUserId: string) => {
    try {
      setLoadingVisits(true);

      const { data: viewsData, error: viewsError } = await supabase
        .from('profile_views')
        .select('id, viewer_id, viewed_user_id, created_at')
        .eq('viewed_user_id', myUserId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (viewsError) {
        console.log('Error cargando visitas al perfil:', viewsError.message);
        return;
      }

      const visits = (viewsData ?? []) as ProfileViewItem[];

      if (visits.length === 0) {
        setVisitsCount(0);
        setProfileVisits([]);
        return;
      }

      const latestVisitByViewer = new Map<string, ProfileViewItem>();

      for (const visit of visits) {
        if (!visit.viewer_id) continue;

        if (!latestVisitByViewer.has(visit.viewer_id)) {
          latestVisitByViewer.set(visit.viewer_id, visit);
        }
      }

      const uniqueVisits = Array.from(latestVisitByViewer.values());

      setVisitsCount(uniqueVisits.length);

      const uniqueViewerIds = uniqueVisits.map((item) => item.viewer_id);

      const { data: viewerProfiles, error: viewerProfilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', uniqueViewerIds);

      if (viewerProfilesError) {
        console.log('Error cargando perfiles de visitas:', viewerProfilesError.message);
        return;
      }

      const viewerMap: Record<string, ViewerProfile> = {};
      (viewerProfiles ?? []).forEach((viewer: ViewerProfile) => {
        viewerMap[viewer.id] = viewer;
      });

      const mergedVisits: VisitCardItem[] = uniqueVisits.map((visit) => ({
        id: visit.id,
        viewer_id: visit.viewer_id,
        created_at: visit.created_at,
        username: viewerMap[visit.viewer_id]?.username ?? 'Usuario',
        avatar_url: viewerMap[visit.viewer_id]?.avatar_url ?? null,
      }));

      setProfileVisits(mergedVisits);
    } catch (error) {
      console.log('Error inesperado cargando visitas:', error);
    } finally {
      setLoadingVisits(false);
    }
  };

  const loadProfile = useCallback(async () => {
    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.log('Error obteniendo usuario:', userError.message);
        setLoading(false);
        return;
      }

      const user = data.user;

      if (!user) {
        router.replace('/login');
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? '');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username, coins, avatar_url, bio')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('Error cargando perfil:', error.message);
        setLoading(false);
        return;
      }

      const profileData = profile as ProfileRow;

      setUsername(profileData?.username ?? '');
      setCoins(profileData?.coins ?? 0);
      setAvatarUrl(profileData?.avatar_url ?? null);
      setBio(profileData?.bio ?? '');

      await Promise.all([loadProfileViews(user.id), loadFollowStats(user.id)]);
    } catch (error) {
      console.log('Error inesperado cargando perfil:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const getFileExtensionFromUri = (uri: string) => {
    const cleanUri = uri.split('?')[0];
    const ext = cleanUri.split('.').pop()?.toLowerCase();

    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
      return ext;
    }

    return 'jpg';
  };

  const getContentType = (ext: string) => {
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Permití acceso a la galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      await uploadAvatar(uri);
    } catch (error) {
      console.log('Error eligiendo imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!userId) {
      Alert.alert('Error', 'No se encontró el usuario');
      return;
    }

    try {
      setUploading(true);

      const fileExt = getFileExtensionFromUri(uri);
      const safeExt = fileExt === 'jpeg' ? 'jpg' : fileExt;
      const filePath = `avatar-${userId}.${safeExt}`;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = decode(base64);
      const contentType = getContentType(safeExt);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType,
        });

      if (uploadError) {
        console.log('Error subiendo imagen a storage:', uploadError.message);
        Alert.alert('Error', uploadError.message);
        return;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      setAvatarUrl(publicUrl);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
        })
        .eq('id', userId);

      if (updateError) {
        console.log('Error guardando avatar_url en profiles:', updateError.message);
        Alert.alert('Error', updateError.message);
        return;
      }

      Alert.alert('Listo', 'Foto de perfil actualizada');
    } catch (error) {
      console.log('Error subiendo imagen:', error);
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'No se encontró el usuario');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Error', 'Nombre requerido');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
        })
        .eq('id', userId);

      if (error) {
        console.log('Error guardando perfil:', error.message);
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert('Listo', 'Perfil actualizado');
    } catch (error) {
      console.log('Error guardando perfil:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUserId = async () => {
    if (!userId) return;
    await Clipboard.setStringAsync(userId);
    Alert.alert('Listo', 'ID copiado');
  };

  const formatVisitedAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60000) return 'Hace un momento';

    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `Hace ${diffDays} d`;

    return date.toLocaleDateString();
  };

  const avatarLetter = username?.trim()?.charAt(0)?.toUpperCase() || 'U';

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#D9A85C" size="large" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backCircle}>
            <Text style={styles.back}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Perfil</Text>

          <View style={styles.settingsCircle}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Pressable onPress={pickImage} style={styles.avatarWrapper}>
            <View style={styles.avatarGlow}>
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{avatarLetter}</Text>
                )}

                {uploading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#FFD38A" />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✓</Text>
            </View>
          </Pressable>

          <Text style={styles.changePhoto}>Cambiar foto</Text>

          <Text style={styles.profileName}>{username || 'Tu perfil'} ✨</Text>
          <Text style={styles.profileEmail}>{email}</Text>

          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>En línea</Text>
          </View>

          <View style={styles.statsRow}>
            <Pressable
              style={styles.statBox}
              onPress={() =>
                router.push({
                  pathname: '/follow-list',
                  params: {
                    userId,
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
                    userId,
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
                {userId}
              </Text>
            </View>

            <Pressable style={styles.copyButton} onPress={handleCopyUserId}>
              <Text style={styles.copyButtonText}>Copiar</Text>
            </Pressable>
          </View>

          <View style={styles.coinsBox}>
            <View>
              <Text style={styles.coinsLabel}>Monedas</Text>
              <Text style={styles.coinsValue}>🪙 {coins}</Text>
            </View>

            <Pressable style={styles.rechargeButton} onPress={() => router.push('/coins')}>
              <Text style={styles.rechargeButtonText}>Recargar</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.visitsCard}>
          <View style={styles.visitsHeader}>
            <Text style={styles.visitsTitle}>Visitas a tu perfil</Text>
            <Pressable
              onPress={() => {
                if (userId) {
                  loadProfileViews(userId);
                  loadFollowStats(userId);
                }
              }}
            >
              <Text style={styles.refreshText}>Actualizar</Text>
            </Pressable>
          </View>

          <Text style={styles.visitsCount}>
            {visitsCount === 0
              ? 'Todavía nadie vio tu perfil'
              : visitsCount === 1
              ? '1 persona vio tu perfil'
              : `${visitsCount} personas vieron tu perfil`}
          </Text>

          {loadingVisits ? (
            <View style={styles.visitsLoading}>
              <ActivityIndicator color="#D9A85C" />
            </View>
          ) : profileVisits.length === 0 ? (
            <Text style={styles.emptyVisitsText}>
              Cuando otros usuarios entren a tu perfil, aparecerán acá.
            </Text>
          ) : (
            <View style={styles.visitsList}>
              {profileVisits.slice(0, 5).map((visit) => (
                <View key={visit.id} style={styles.visitItem}>
                  <View style={styles.visitLeft}>
                    {visit.avatar_url ? (
                      <Image
                        source={{ uri: visit.avatar_url }}
                        style={styles.visitAvatar}
                      />
                    ) : (
                      <View style={styles.visitAvatarFallback}>
                        <Text style={styles.visitAvatarLetter}>
                          {visit.username?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}

                    <View style={styles.visitInfo}>
                      <Text style={styles.visitUsername}>{visit.username}</Text>
                      <Text style={styles.visitTime}>
                        Vio tu perfil {formatVisitedAgo(visit.created_at)}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.visitProfileButton}
                    onPress={() =>
                      router.push({
                        pathname: '/user-profile',
                        params: { userId: visit.viewer_id },
                      })
                    }
                  >
                    <Text style={styles.visitProfileButtonText}>Ver</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Editar perfil</Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Tu nombre"
            placeholderTextColor="#6f7480"
            maxLength={30}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            multiline
            value={bio}
            onChangeText={setBio}
            placeholder="Contá algo sobre vos..."
            placeholderTextColor="#6f7480"
            maxLength={180}
          />

          <Text style={styles.bioCounter}>{bio.length}/180</Text>

          <Pressable
            style={[styles.button, (saving || uploading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving || uploading}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },
  loadingText: {
    color: '#B8B8B8',
    marginTop: 12,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  header: {
    height: 54,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backCircle: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    color: GOLD_LIGHT,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '300',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  settingsCircle: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    color: GOLD_LIGHT,
    fontSize: 18,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 30,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    shadowColor: GOLD,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarWrapper: {
    marginBottom: 8,
    position: 'relative',
  },
  avatarGlow: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 2,
    borderColor: GOLD_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD_LIGHT,
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1C1710',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#5A3D1D',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: GOLD_LIGHT,
    fontSize: 44,
    fontWeight: '900',
  },
  avatarOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: CARD,
  },
  editBadgeText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '900',
  },
  changePhoto: {
    textAlign: 'center',
    color: GOLD_LIGHT,
    marginBottom: 14,
    fontWeight: '800',
    fontSize: 14,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#9A9A9A',
    fontSize: 13,
    marginBottom: 10,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1F17',
    borderColor: '#1B5C38',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 18,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#44D17A',
    marginRight: 6,
  },
  onlineText: {
    color: '#44D17A',
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: CARD_SOFT,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#A9A9A9',
    fontSize: 13,
    fontWeight: '700',
  },
  userIdBox: {
    width: '100%',
    backgroundColor: CARD_SOFT,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userIdInfo: {
    flex: 1,
    paddingRight: 10,
  },
  userIdLabel: {
    color: '#9A9A9A',
    fontSize: 13,
    marginBottom: 4,
  },
  userIdValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  copyButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  copyButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
  },
  coinsBox: {
    width: '100%',
    backgroundColor: '#18120B',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#5A3D1D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coinsLabel: {
    color: '#B8B8B8',
    fontSize: 13,
    marginBottom: 4,
  },
  coinsValue: {
    color: GOLD_LIGHT,
    fontSize: 20,
    fontWeight: '900',
  },
  rechargeButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 17,
  },
  rechargeButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
  },
  visitsCard: {
    backgroundColor: CARD,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  visitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  visitsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  refreshText: {
    color: GOLD_LIGHT,
    fontSize: 13,
    fontWeight: '800',
  },
  visitsCount: {
    color: '#C8C8C8',
    fontSize: 14,
    marginBottom: 14,
  },
  visitsLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyVisitsText: {
    color: '#8A8A8A',
    fontSize: 14,
    lineHeight: 20,
  },
  visitsList: {
    gap: 10,
  },
  visitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_SOFT,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  visitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  visitInfo: {
    flex: 1,
  },
  visitAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: GOLD,
  },
  visitAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#1C1710',
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitAvatarLetter: {
    color: GOLD_LIGHT,
    fontSize: 18,
    fontWeight: '900',
  },
  visitUsername: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  visitTime: {
    color: '#9A9A9A',
    fontSize: 12,
  },
  visitProfileButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  visitProfileButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: CARD,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 6,
  },
  label: {
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 12,
    fontWeight: '800',
    fontSize: 14,
  },
  input: {
    backgroundColor: CARD_SOFT,
    color: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    fontSize: 15,
  },
  bioInput: {
    height: 112,
    textAlignVertical: 'top',
  },
  bioCounter: {
    color: '#8A8A8A',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  button: {
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 17,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#111111',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
  },
});