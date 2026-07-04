import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  coins: number | null;
  is_online: boolean | null;
};

export default function HomeScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, coins, is_online')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('Error cargando perfil:', error.message);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.log('Error inesperado:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#D9A85C" size="large" />
      </View>
    );
  }

  const avatar =
    profile?.avatar_url ||
    'https://ui-avatars.com/api/?name=Chattera&background=151515&color=D9A85C';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Chattera</Text>
            <Text style={styles.subtitle}>Conecta. Habla. Brilla.</Text>
          </View>

          <Pressable style={styles.crownButton}>
            <Ionicons name="diamond" size={21} color="#FFD38A" />
          </Pressable>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile?.username || 'Usuario'}</Text>
              <Ionicons name="shield-checkmark" size={16} color="#FFD38A" />
            </View>

            <Text style={styles.userId}>ID: chattera_001</Text>

            <View style={styles.onlineRow}>
              <View style={styles.greenDot} />
              <Text style={styles.onlineText}>En línea</Text>
            </View>
          </View>

          <Pressable style={styles.coinBox} onPress={() => router.push('/coins')}>
            <Ionicons name="logo-bitcoin" size={17} color="#FFD38A" />
            <Text style={styles.coins}>{profile?.coins ?? 0}</Text>
            <Ionicons name="add-circle" size={23} color="#D9A85C" />
          </Pressable>
        </View>

        <View style={styles.quickGrid}>
          <HomeAction icon="mic" label="Salas" route="/voice-rooms" />
          <HomeAction icon="chatbubble-ellipses" label="Chats" route="/chats" />
          <HomeAction icon="people" label="Amigos" route="/discover" />
          <HomeAction icon="gift" label="Regalos" route="/shop" />
          <HomeAction icon="trophy" label="Logros" route="/achievements" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Salas Populares</Text>
          <Pressable onPress={() => router.push('/voice-rooms')}>
            <Text style={styles.seeAll}>Ver todas</Text>
          </Pressable>
        </View>

        <RoomCard
          image="https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=300"
          title="Chill & Talk"
          subtitle="Conversación"
          people={128}
        />

        <RoomCard
          image="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300"
          title="Música 24/7"
          subtitle="Escuchando"
          people={96}
        />

        <RoomCard
          image="https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=300"
          title="Charla Random"
          subtitle="Conversando"
          people={73}
        />

        <RoomCard
          image="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300"
          title="Juegos & Friends"
          subtitle="Jugando"
          people={62}
        />

        <View style={styles.premiumBox}>
          <Ionicons name="sparkles" size={26} color="#FFD38A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>Chattera Premium</Text>
            <Text style={styles.premiumText}>
              Destaca tu perfil, gana insignias y brilla en las salas.
            </Text>
          </View>
          <Pressable style={styles.premiumButton}>
            <Text style={styles.premiumButtonText}>Ver</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TabButton icon="home" label="Inicio" active route="/home" />
        <TabButton icon="search" label="Salas" route="/voice-rooms" />
        <Pressable style={styles.plusButton}>
          <Ionicons name="add" size={30} color="#111" />
        </Pressable>
        <TabButton icon="chatbubble" label="Chats" route="/chats" />
        <TabButton icon="person" label="Perfil" route="/profile" />
      </View>
    </View>
  );
}

function HomeAction({
  icon,
  label,
  route,
}: {
  icon: any;
  label: string;
  route: string;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={24} color="#FFD38A" />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function RoomCard({
  image,
  title,
  subtitle,
  people,
}: {
  image: string;
  title: string;
  subtitle: string;
  people: number;
}) {
  return (
    <Pressable style={styles.roomCard} onPress={() => router.push('/voice-rooms')}>
      <Image source={{ uri: image }} style={styles.roomImage} />

      <View style={{ flex: 1 }}>
        <Text style={styles.roomTitle}>{title}</Text>
        <Text style={styles.roomSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.peopleBox}>
        <Ionicons name="person" size={13} color="#FFD38A" />
        <Text style={styles.peopleText}>{people}</Text>
      </View>
    </Pressable>
  );
}

function TabButton({
  icon,
  label,
  active,
  route,
}: {
  icon: any;
  label: string;
  active?: boolean;
  route: string;
}) {
  return (
    <Pressable style={styles.tabButton} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={21} color={active ? '#FFD38A' : '#777'} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090D',
  },
  loading: {
    flex: 1,
    backgroundColor: '#07090D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingTop: 55,
    paddingHorizontal: 18,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    color: '#B8B8B8',
    marginTop: 4,
    fontSize: 13,
  },
  crownButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#3A2A16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginTop: 24,
    backgroundColor: '#111318',
    borderRadius: 26,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  avatarBox: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#D9A85C',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#44D17A',
    borderWidth: 2,
    borderColor: '#111318',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 13,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  userId: {
    color: '#8F8F8F',
    fontSize: 12,
    marginTop: 4,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#44D17A',
    marginRight: 5,
  },
  onlineText: {
    color: '#44D17A',
    fontSize: 12,
  },
  coinBox: {
    alignItems: 'center',
    gap: 3,
  },
  coins: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  quickGrid: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '18%',
    height: 72,
    backgroundColor: '#111318',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#242018',
  },
  actionText: {
    color: '#D8D8D8',
    fontSize: 11,
    marginTop: 7,
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
  },
  seeAll: {
    color: '#D9A85C',
    fontSize: 13,
  },
  roomCard: {
    backgroundColor: '#111318',
    borderRadius: 22,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232018',
  },
  roomImage: {
    width: 52,
    height: 52,
    borderRadius: 17,
    marginRight: 12,
  },
  roomTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  roomSubtitle: {
    color: '#9A9A9A',
    fontSize: 12,
    marginTop: 3,
  },
  peopleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peopleText: {
    color: '#FFD38A',
    fontSize: 13,
    fontWeight: '700',
  },
  premiumBox: {
    marginTop: 12,
    backgroundColor: '#17120B',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: '#5A3D1D',
  },
  premiumTitle: {
    color: '#FFD38A',
    fontSize: 16,
    fontWeight: '800',
  },
  premiumText: {
    color: '#B8B8B8',
    fontSize: 12,
    marginTop: 3,
  },
  premiumButton: {
    backgroundColor: '#D9A85C',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
  },
  premiumButtonText: {
    color: '#111',
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
    height: 72,
    backgroundColor: '#101216',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#2B2116',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 55,
  },
  tabText: {
    color: '#777',
    fontSize: 10,
    marginTop: 4,
  },
  tabTextActive: {
    color: '#FFD38A',
  },
  plusButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#D9A85C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: '#D9A85C',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
});