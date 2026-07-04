import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { setUserOffline, setUserOnline, subscribeToPresence } from '@/lib/presence';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let currentUserId: string | null = null;
    let unsubscribePresence: (() => void) | null = null;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        currentUserId = session?.user?.id ?? null;

        if (currentUserId) {
          setUserOnline(currentUserId);
          unsubscribePresence = subscribeToPresence(currentUserId);
        }
      } catch (error) {
        console.log('Error iniciando layout:', error);
      } finally {
        setIsReady(true);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;

      if (unsubscribePresence) {
        unsubscribePresence();
        unsubscribePresence = null;
      }

      if (currentUserId && currentUserId !== newUserId) {
        setUserOffline(currentUserId);
      }

      currentUserId = newUserId;

      if (currentUserId) {
        setUserOnline(currentUserId);
        unsubscribePresence = subscribeToPresence(currentUserId);
      }

      setIsReady(true);
    });

    return () => {
      if (unsubscribePresence) {
        unsubscribePresence();
      }

      if (currentUserId) {
        setUserOffline(currentUserId);
      }

      subscription.unsubscribe();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="home" />
        <Stack.Screen name="discover" />
        <Stack.Screen name="chats" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="profile" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}