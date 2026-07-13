import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
    router.push({
      pathname: '/room',
      params: {
        roomId: String(item.id),
        title: item.title || 'Sala',
      },
    });
  };

  const renderRoom = ({ item, index }: { item: Room; index: number }) => (
    <Pressable style={styles.roomCard} onPress={() => openRoom(item)}>
      <View style={styles.roomGlow} />

      <View style={styles.roomTop}>
        <View style={styles.avatarStack}>
          <View style={[styles.avatarCircle, styles.avatarOne]}>
            <Ionicons name="mic" size={18} color="#151000" />
          </View>

          <View style={[styles.avatarCircle, styles.avatarTwo]}>
            <Ionicons name="flame" size={18} color="#151000" />
          </View>

          <View style={[styles.avatarCircle, styles.avatarThree]}>
            <Ionicons name="diamond" size={17} color="#151000" />
          </View>
        </View>

        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>
            {index === 0 ? 'TOP LIVE' : 'EN VIVO'}
          </Text>
        </View>
      </View>

      <Text numberOfLines={1} style={styles.roomTitle}>
        {item.title || 'Sala de voz'}
      </Text>

      <Text numberOfLines={2} style={styles.roomDescription}>
        Entrá, hablá en vivo, conocé gente nueva y destacá dentro de Chattera.
      </Text>

      <View style={styles.roomStats}>
        <View style={styles.statItem}>
          <Ionicons name="radio" size={14} color="#FFD38A" />
          <Text style={styles.statText}>Sala activa</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="gift" size={14} color="#FFD38A" />
          <Text style={styles.statText}>Gifts</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="trophy" size={14} color="#FFD38A" />
          <Text style={styles.statText}>Ranking</Text>
        </View>
      </View>

      <View style={styles.roomBottom}>
        <View>
          <Text style={styles.createdText}>Chattera Live</Text>
          <Text style={styles.roomStatus}>Disponible ahora</Text>
        </View>

        <View style={styles.enterButton}>
          <Text style={styles.enterText}>Entrar</Text>
          <Ionicons name="chevron-forward" size={16} color="#151000" />
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.goldGlowTop} />
      <View style={styles.goldGlowBottom} />

      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>CHATTERA LIVE</Text>
          <Text style={styles.title}>Salas de voz</Text>
          <Text style={styles.subtitle}>
            Entrá a salas en vivo, hablá y brillá.
          </Text>
        </View>

        <Pressable
          style={styles.createCircle}
          onPress={() => router.push('/create-room')}
        >
          <Ionicons name="add" size={30} color="#151000" />
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
          <View style={styles.crownCircle}>
            <Ionicons name="diamond" size={32} color="#FFD38A" />
          </View>

          <View style={styles.heroLiveBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.heroLiveText}>LIVE</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickRow}>
        <View style={styles.quickCard}>
          <Ionicons name="gift" size={22} color="#FFD38A" />
          <Text style={styles.quickText}>Regalos</Text>
        </View>

        <View style={styles.quickCard}>
          <Ionicons name="trophy" size={22} color="#FFD38A" />
          <Text style={styles.quickText}>Ranking</Text>
        </View>

        <View style={styles.quickCard}>
          <Ionicons name="chatbubbles" size={22} color="#FFD38A" />
          <Text style={styles.quickText}>Chat</Text>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Disponibles ahora</Text>

        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={14} color="#FFD38A" />
          <Text style={styles.refreshText}>Actualizar</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#D9A85C" size="large" />
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
              tintColor="#D9A85C"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="headset" size={38} color="#FFD38A" />
              </View>

              <Text style={styles.emptyTitle}>No hay salas activas</Text>

              <Text style={styles.emptyText}>
                Crea una sala premium y empieza una conversación en vivo.
              </Text>

              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/create-room')}
              >
                <Ionicons name="add-circle" size={18} color="#151000" />
                <Text style={styles.emptyButtonText}>Crear primera sala</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const GOLD = '#D9A85C';
const GOLD_LIGHT = '#FFD38A';
const DARK = '#07090D';
const CARD = '#111318';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  goldGlowTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(217, 168, 92, 0.16)',
    top: -80,
    right: -110,
  },
  goldGlowBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 211, 138, 0.08)',
    bottom: 30,
    left: -110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  kicker: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  title: {
    color: '#ffffff',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#B8A66F',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
    maxWidth: 250,
  },
  createCircle: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GOLD_LIGHT,
    shadowColor: GOLD,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
  heroCard: {
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(217,168,92,0.35)',
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSmall: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroNumber: {
    color: GOLD_LIGHT,
    fontSize: 40,
    fontWeight: '900',
  },
  heroLabel: {
    color: '#E8E8E8',
    fontSize: 13,
    fontWeight: '800',
  },
  heroRight: {
    alignItems: 'center',
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#17120B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5A3D1D',
    marginBottom: 8,
  },
  heroLiveBadge: {
    backgroundColor: 'rgba(68, 209, 122, 0.12)',
    borderColor: '#44D17A',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#44D17A',
  },
  heroLiveText: {
    color: '#44D17A',
    fontSize: 11,
    fontWeight: '900',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#111318',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242018',
  },
  quickText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
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
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#17120B',
    borderWidth: 1,
    borderColor: '#5A3D1D',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  refreshText: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
  },
  loadingBox: {
    marginTop: 60,
    alignItems: 'center',
  },
  loadingText: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 34,
  },
  roomCard: {
    backgroundColor: CARD,
    borderRadius: 27,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(217,168,92,0.28)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  roomGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(217, 168, 92, 0.12)',
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
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111318',
  },
  avatarOne: {
    backgroundColor: GOLD_LIGHT,
  },
  avatarTwo: {
    backgroundColor: '#E8B866',
    marginLeft: -10,
  },
  avatarThree: {
    backgroundColor: '#D9A85C',
    marginLeft: -10,
  },
  livePill: {
    backgroundColor: 'rgba(255, 211, 138, 0.12)',
    borderColor: GOLD_LIGHT,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#44D17A',
  },
  livePillText: {
    color: GOLD_LIGHT,
    fontSize: 11,
    fontWeight: '900',
  },
  roomTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 15,
  },
  roomDescription: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 6,
  },
  roomStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statItem: {
    backgroundColor: '#17120B',
    borderWidth: 1,
    borderColor: '#3A2A16',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: '#D8D8D8',
    fontSize: 11,
    fontWeight: '800',
  },
  roomBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  createdText: {
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: '900',
  },
  roomStatus: {
    color: '#8F8F8F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  enterButton: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  enterText: {
    color: '#151000',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyBox: {
    marginTop: 55,
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(217,168,92,0.28)',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 28,
    backgroundColor: '#17120B',
    borderWidth: 1,
    borderColor: '#5A3D1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: '#B8B8B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  emptyButton: {
    backgroundColor: GOLD,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  emptyButtonText: {
    color: '#151000',
    fontSize: 13,
    fontWeight: '900',
  },
});