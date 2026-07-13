import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert('Error', 'Completá correo y contraseña');
      return;
    }

    if (cleanPassword.length < 6) {
      Alert.alert(
        'Contraseña muy corta',
        'La contraseña debe tener al menos 6 caracteres.'
      );
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        Alert.alert('Error al crear la cuenta', error.message);
        return;
      }

      Alert.alert(
        'Cuenta creada',
        'Tu cuenta fue creada correctamente.',
        [
          {
            text: 'Iniciar sesión',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error) {
      console.log('Error registro:', error);
      Alert.alert('Error', 'Ocurrió un problema al registrarte');
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
          <View style={styles.logoWrapper}>
            <Image
              source={require('../assets/images/chattera-logo.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.title}>CHATTERA</Text>

          <Text style={styles.subtitle}>
            Creá tu cuenta y empezá a conectar con nuevas personas
          </Text>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Correo electrónico</Text>

            <TextInput
              placeholder="tu@email.com"
              placeholderTextColor="#746B5A"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
            />

            <Text style={styles.inputLabel}>Contraseña</Text>

            <TextInput
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#746B5A"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              onSubmitEditing={handleRegister}
              returnKeyType="done"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              loading && styles.disabledButton,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>CHATTERA PREMIUM</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
            ]}
            onPress={() => router.replace('/login')}
            disabled={loading}
          >
            <Text style={styles.loginText}>¿Ya tenés una cuenta?</Text>
            <Text style={styles.goldText}> Iniciar sesión</Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          Chattera · conversaciones, salas y comunidad
        </Text>
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
    paddingTop: 26,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.30)',
    shadowColor: GOLD,
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },

  logoWrapper: {
    width: 132,
    height: 132,
    borderRadius: 34,
    alignSelf: 'center',
    padding: 4,
    backgroundColor: '#08080F',
    borderWidth: 2,
    borderColor: GOLD,
    shadowColor: GOLD_LIGHT,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    overflow: 'hidden',
  },

  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
  },

  title: {
    color: GOLD_LIGHT,
    fontSize: 31,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: 18,
  },

  subtitle: {
    color: '#BDAE8A',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 27,
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  formSection: {
    marginBottom: 4,
  },

  inputLabel: {
    color: '#D8C99D',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 3,
  },

  input: {
    backgroundColor: '#0B0B14',
    color: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
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
    marginTop: 6,
    shadowColor: GOLD,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },

  primaryButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },

  disabledButton: {
    opacity: 0.65,
  },

  primaryButtonText: {
    color: '#171000',
    fontSize: 17,
    fontWeight: '900',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 18,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245, 197, 66, 0.18)',
  },

  dividerText: {
    color: '#74694E',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginHorizontal: 10,
  },

  loginButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 66, 0.24)',
    backgroundColor: 'rgba(245, 197, 66, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },

  loginButtonPressed: {
    opacity: 0.75,
  },

  loginText: {
    color: '#929297',
    fontSize: 14,
    fontWeight: '700',
  },

  goldText: {
    color: GOLD_LIGHT,
    fontWeight: '900',
    fontSize: 14,
  },

  footerText: {
    color: '#625D6C',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
  },
});