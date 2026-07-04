import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';

type NotificationRow = {
  id: number;
  user_id: string;
  actor_id?: string | null;
  type: 'follow' | 'profile_view' | 'message';
  title: string;
  body?: string | null;
  related_user_id?: string | null;
  related_message_id?: number | null;
  is_read: boolean;
  created_at: string;
};

type ActorProfile = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
};

type NotificationItem = NotificationRow & {
  actor_username: string;
  actor_avatar_url?: string | null;
};

export default function NotificationsScreen() {
  const [myUserId, setMyUserId] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  const playNotificationFeedback = async () => {
    try {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      const { sound } = await Audio.Sound.createAsync(
        require('../assets/notification.mp3')
      );

      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Error sonido:', error);
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.replace('/login');
        return;
      }

      setMyUserId(user.id);

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setNotifications(data || []);
    } catch (error) {
      console.log('Error cargando:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  useEffect(() => {
    if (!myUserId) return;

    const channel = supabase
      .channel(`notifications-${myUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${myUserId}`,
        },
        async () => {
          await playNotificationFeedback();
          await loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notificaciones</Text>

      {loading ? (
        <ActivityIndicator color="#8b5cf6" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.text}>
                {item.title || 'Notificación'}
              </Text>
            </View>
          )}
        />
      )}

      <Text style={styles.subtitle}>
        {unreadCount} sin leer
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f1a',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    color: '#aaa',
    marginTop: 10,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  text: {
    color: '#fff',
  },
});