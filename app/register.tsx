import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Completá los datos');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      const handleRegister = async () => {
  if (!email || !password) {
    Alert.alert('Error', 'Completá los datos');
    return;
  }

  try {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Cuenta creada correctamente');
    router.replace('/login');
  } catch {
    Alert.alert('Error', 'Ocurrió un problema al registrarte');
  } finally {
    setLoading(false);
  }
};

      Alert.alert('Cuenta creada correctamente');
      router.replace('/login');
    } catch {
      Alert.alert('Error', 'Ocurrió un problema al registrarte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      <TextInput
        placeholder="Correo electrónico"
        placeholderTextColor="#8e8e93"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        placeholder="Contraseña"
        placeholderTextColor="#8e8e93"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={[styles.primaryButton, loading && styles.disabledButton]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? 'Creando...' : 'Registrarme'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace('/login')}>
       <Text style={styles.backText}>¿Ya tienes cuenta? Inicia sesión</Text>
      </Pressable>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1020',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 28,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1b1c31',
    color: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: '#a855f7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  backText: {
    color: '#a855f7',
    textAlign: 'center',
    marginTop: 18,
    fontSize: 16,
  },
});