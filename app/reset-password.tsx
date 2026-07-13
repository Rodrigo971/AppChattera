import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const createSessionFromUrl = async (url: string | null) => {
      if (!url) return;

      try {
        const fragment = url.split('#')[1];

        if (!fragment) {
          Alert.alert(
            'Enlace inválido',
            'El enlace de recuperación no contiene una sesión válida.'
          );
          return;
        }

        const params = new URLSearchParams(fragment);

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
          Alert.alert(
            'Enlace inválido',
            'No se encontraron los datos necesarios para recuperar la cuenta.'
          );
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        setSessionReady(true);
      } catch (error) {
        console.log('Error procesando enlace:', error);

        Alert.alert(
          'Error',
          'No se pudo procesar el enlace de recuperación.'
        );
      }
    };

    Linking.getInitialURL().then(createSessionFromUrl);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      createSessionFromUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (!sessionReady) {
      Alert.alert(
        'Sesión no disponible',
        'Volvé a abrir el enlace de recuperación recibido por correo.'
      );
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Completá ambas contraseñas');
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Contraseña muy corta',
        'La contraseña debe tener al menos 6 caracteres.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña fue cambiada correctamente.',
        [
          {
            text: 'Iniciar sesión',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/login');
            },
          },
        ]
      );
    } catch (error) {
      console.log('Error actualizando contraseña:', error);
      Alert.alert('Error', 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>NUEVA CONTRASEÑA</Text>

          <Text style={styles.subtitle}>
            {sessionReady
              ? 'Ingresá tu nueva contraseña.'
              : 'Validando el enlace de recuperación...'}
          </Text>

          <Text style={styles.inputLabel}>Nueva contraseña</Text>

          <TextInput
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#746B5A"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            editable={!loading && sessionReady}
          />

          <Text style={styles.inputLabel}>Confirmar contraseña</Text>

          <TextInput
            placeholder="Repetí la nueva contraseña"
            placeholderTextColor="#746B5A"
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading && sessionReady}
            onSubmitEditing={handleUpdatePassword}
            returnKeyType="done"
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              (!sessionReady || loading) && styles.disabledButton,
            ]}
            onPress={handleUpdatePassword}
            disabled={!sessionReady || loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading
                ? 'Actualizando...'
                : sessionReady
                  ? 'Cambiar contraseña'
                  : 'Validando enlace...'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.backButton}
            onPress={() => router.replace('/login')}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>
              Volver al inicio de sesión
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GOLD = '#F5C542';
const GOLD_LIGHT = '#FFD978';
const DARK = '#08080F';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 38,
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(123, 44, 191, 0.18)',
    top: -120,
    right: -130,
  },
  glowBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245, 197, 66, 0.10)',
    bottom: -130,
    left: -120,
  },
  card: {
    backgroundColor: 'rgba(18, 18, 32, 0.96)',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.30)',
    elevation: 14,
  },
  title: {
    color: GOLD_LIGHT,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#BDAE8A',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
  },
  inputLabel: {
    color: '#D8C99D',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0B0B14',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.20)',
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: GOLD,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#171000',
    fontSize: 16,
    fontWeight: '900',
  },
  backButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  backButtonText: {
    color: GOLD_LIGHT,
    fontSize: 14,
    fontWeight: '800',
  },
});