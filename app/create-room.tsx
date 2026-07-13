import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function CreateRoomScreen() {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const createRoom = async () => {
    if (!title.trim()) {
      Alert.alert('Falta un nombre', 'Escribí un nombre para la sala.');
      return;
    }

    if (creating) return;

    try {
      setCreating(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        Alert.alert('Error', 'No se pudo obtener tu usuario.');
        return;
      }

      const { data, error } = await supabase
        .from('voice_rooms')
        .insert({
          creator_id: authData.user.id,
          title: title.trim(),
          is_live: true,
        })
        .select('id, title')
        .single();

      if (error) {
        console.log('Error creando sala:', error.message);
        Alert.alert('Error', 'No se pudo crear la sala.');
        return;
      }

      router.replace({
        pathname: '/room',
        params: {
          roomId: data.id,
          title: data.title,
        },
      });
    } catch (error) {
      console.log('Error inesperado creando sala:', error);
      Alert.alert('Error', 'Ocurrió un problema creando la sala.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="mic" size={34} color="#FFD38A" />
        </View>

        <Text style={styles.title}>Crear sala</Text>

        <Text style={styles.subtitle}>
          Abrí una sala premium para hablar, conocer gente y recibir regalos.
        </Text>

        <View style={styles.inputBox}>
          <Ionicons name="sparkles" size={18} color="#D9A85C" />
          <TextInput
            style={styles.input}
            placeholder="Ej: Charla Uruguay 🇺🇾"
            placeholderTextColor="#8b7b55"
            value={title}
            onChangeText={setTitle}
            maxLength={40}
            editable={!creating}
          />
        </View>

        <Text style={styles.counter}>{title.length}/40 caracteres</Text>

        <Pressable
          style={[styles.button, creating && styles.buttonDisabled]}
          onPress={createRoom}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#151000" />
          ) : (
            <>
              <Ionicons name="radio" size={19} color="#151000" />
              <Text style={styles.buttonText}>Crear y entrar</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={creating}
        >
          <Ionicons name="chevron-back" size={18} color="#B8A66F" />
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>
      </View>
    </View>
  );
}

const GOLD = '#f5c542';
const GOLD_LIGHT = '#FFD38A';
const DARK = '#08080f';
const CARD = '#121220';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,197,66,0.25)',
    shadowColor: GOLD,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(245,197,66,0.12)',
    borderWidth: 1,
    borderColor: GOLD,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    color: GOLD,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  subtitle: {
    color: '#b8a66f',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 26,
    lineHeight: 22,
  },
  inputBox: {
    backgroundColor: '#0b0b14',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,197,66,0.18)',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  counter: {
    color: '#8b7b55',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 18,
  },
  button: {
    backgroundColor: GOLD,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#151000',
    fontSize: 17,
    fontWeight: '900',
  },
  backButton: {
    marginTop: 18,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  backButtonText: {
    color: '#B8A66F',
    fontSize: 15,
    fontWeight: '800',
  },
});