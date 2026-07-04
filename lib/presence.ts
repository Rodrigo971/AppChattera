import { AppState } from 'react-native';
import { supabase } from './supabase';

export async function setUserOnline(userId: string) {
  if (!userId) return;

  const now = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_online: true,
        last_seen: now,
        updated_at: now,
      })
      .eq('id', userId);

    if (error) {
      console.log('Error al poner usuario online:', error.message);
    }
  } catch (error) {
    console.log('Error inesperado al poner usuario online:', error);
  }
}

export async function setUserOffline(userId: string) {
  if (!userId) return;

  const now = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_online: false,
        last_seen: now,
        updated_at: now,
      })
      .eq('id', userId);

    if (error) {
      console.log('Error al poner usuario offline:', error.message);
    }
  } catch (error) {
    console.log('Error inesperado al poner usuario offline:', error);
  }
}

export function subscribeToPresence(userId: string) {
  if (!userId) {
    return () => {};
  }

  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      setUserOnline(userId);
    } else if (nextState === 'inactive' || nextState === 'background') {
      setUserOffline(userId);
    }
  });

  return () => {
    subscription.remove();
  };
}