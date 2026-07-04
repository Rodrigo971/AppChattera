import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Room = {
  id: string;
  title: string;
  creator_id: string;
  created_at: string;
  is_live?: boolean;
};

export default function VoiceRoomsScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('voice_rooms')
        .select('*')
        .eq('is_live', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error cargando salas:', error.message);
        return;
      }

      setRooms(data || []);
    } catch (error) {
      console.log('Error inesperado:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRooms();
  };

  useEffect(() => {
    loadRooms();

    const roomsChannel = supabase
      .channel('voice-rooms-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_rooms',
        },
        () => {
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
    };
  }, []);

  const openRoom = (item: Room) => {
    console.log('ABRIENDO SALA:', item.id, item.title);

    router.push({
  pathname: '/room',
  params: {
    roomId: String(item.id),
    title: item.title || 'Sala',
  },
});
}
  const renderRoom = ({ item, index }: { item: Room; index: number }) => (
    <Pressable style={styles.roomCard} onPress={() => openRoom(item)}>
      <View style={styles.roomGlow} />

      <View style={styles.roomTop}>
        <View style={styles.avatarStack}>
          <View style={[styles.avatarCircle, styles.avatarOne]}>
            <Text style={styles.avatarText}>🎙️</Text>
          </View>

          <View style={[styles.avatarCircle, styles.avatarTwo]}>
            <Text style={styles.avatarText}>🔥</Text>
          </View>

          <View style={[styles.avatarCircle, styles.avatarThree]}>
            <Text style={styles.avatarText}>💎</Text>
          </View>
        </View>

        <View style={styles.hotBadge}>
          <Text style={styles.hotBadgeText}>
            {index === 0 ? 'TOP LIVE' : 'EN VIVO'}
          </Text>
        </View>
      </View>

      <Text numberOfLines={1} style={styles.roomTitle}>
        {item.title || 'Sala de voz'}
      </Text>

      <Text numberOfLines={2} style={styles.roomDescription}>
        Únete a la conversación, conoce gente nueva y participa en la sala.
      </Text>

      <View style={styles.roomBottom}>
        <View style={styles.liveInfo}>
          <Text style={styles.liveDot}>●</Text>
          <Text style={styles.liveText}>Sala activa</Text>
        </View>

        <View style={styles.enterButton}>
          <Text style={styles.enterText}>Entrar</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.glowPink} />
      <View style={styles.glowPurple} />
      <View style={styles.glowBlue} />

      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>CHATTERA LIVE</Text>
          <Text style={styles.title}>Salas de voz</Text>
          <Text style={styles.subtitle}>
            Habla, conoce gente y sube en el ranking
          </Text>
        </View>

        <Pressable
          style={styles.createCircle}
          onPress={() => router.push('/create-room')}
        >
          <Text style={styles.createCircleText}>＋</Text>
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <View>
          <Text style={styles.heroSmall}>Ahora mismo</Text>
          <Text style={styles.heroNumber}>{rooms.length}</Text>
          <Text style={styles.heroLabel}>
            {rooms.length === 1 ? 'sala activa' : 'salas activas'}
          </Text>
        </View>

        <View style={styles.heroRight}>
          <Text style={styles.heroIcon}>👑</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>● LIVE</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickRow}>
        <View style={styles.quickCard}>
          <Text style={styles.quickIcon}>🎁</Text>
          <Text style={styles.quickText}>Gifts</Text>
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickIcon}>🏆</Text>
          <Text style={styles.quickText}>Ranking</Text>
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickIcon}>💬</Text>
          <Text style={styles.quickText}>Chat</Text>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Disponibles ahora</Text>

        <Pressable onPress={onRefresh}>
          <Text style={styles.refreshText}>Actualizar</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#ec4899" size="large" />
          <Text style={styles.loadingText}>Cargando salas...</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ec4899"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🎧</Text>
              <Text style={styles.emptyTitle}>No hay salas activas</Text>
              <Text style={styles.emptyText}>
                Crea una sala y empieza una conversación en vivo.
              </Text>

              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/create-room')}
              >
                <Text style={styles.emptyButtonText}>Crear primera sala</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050514',
    paddingHorizontal: 16,
    paddingTop: 32,
  },
  glowPink: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(236, 72, 153, 0.28)',
    top: 20,
    left: -120,
  },
  glowPurple: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 58, 237, 0.23)',
    top: 120,
    right: -130,
  },
  glowBlue: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(34, 211, 238, 0.13)',
    bottom: 40,
    left: -100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  kicker: {
    color: '#f472b6',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    maxWidth: 250,
  },
  createCircle: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f9a8d4',
    shadowColor: '#ec4899',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  createCircleText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    marginTop: -2,
  },
  heroCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.45)',
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSmall: {
    color: '#f9a8d4',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroNumber: {
    color: '#facc15',
    fontSize: 38,
    fontWeight: '900',
  },
  heroLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '800',
  },
  heroRight: {
    alignItems: 'center',
  },
  heroIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  liveBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.17)',
    borderColor: '#22c55e',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  liveBadgeText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '900',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  quickCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.78)',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  quickIcon: {
    fontSize: 21,
    marginBottom: 5,
  },
  quickText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  refreshText: {
    color: '#f472b6',
    fontSize: 13,
    fontWeight: '900',
  },
  loadingBox: {
    marginTop: 60,
    alignItems: 'center',
  },
  loadingText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  roomCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.26)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  roomGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(236, 72, 153, 0.16)',
    right: -50,
    top: -45,
  },
  roomTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarOne: {
    backgroundColor: '#7c3aed',
  },
  avatarTwo: {
    backgroundColor: '#ec4899',
    marginLeft: -10,
  },
  avatarThree: {
    backgroundColor: '#22d3ee',
    marginLeft: -10,
  },
  avatarText: {
    fontSize: 18,
  },
  hotBadge: {
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    borderColor: '#facc15',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hotBadgeText: {
    color: '#facc15',
    fontSize: 11,
    fontWeight: '900',
  },
  roomTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },
  roomDescription: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 6,
  },
  roomBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  liveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    color: '#22c55e',
    fontSize: 11,
    marginRight: 6,
  },
  liveText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  enterButton: {
    backgroundColor: '#ec4899',
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 9,
  },
  enterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyBox: {
    marginTop: 55,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
  },
  emptyText: {
    color: '#cbd5e1',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 19,
  },
  emptyButton: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 17,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});