import { router } from 'expo-router';
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
      <Text style={styles.title}>Crear sala</Text>
      <Text style={styles.subtitle}>
        Elegí un nombre para tu sala de voz.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Ej: Charla Uruguay 🇺🇾"
        placeholderTextColor="#777"
        value={title}
        onChangeText={setTitle}
        maxLength={40}
      />

      <Pressable
        style={[styles.button, creating && styles.buttonDisabled]}
        onPress={createRoom}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Crear y entrar</Text>
        )}
      </Pressable>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Volver</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1020',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a9a9bb',
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 21,
  },
  input: {
    backgroundColor: '#17192e',
    color: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#232542',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  backButton: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#a9a9bb',
    fontSize: 15,
    fontWeight: '700',
  },
});