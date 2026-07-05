import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const logoScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Completá correo y contraseña');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        Alert.alert('Error al iniciar sesión', error.message);
        return;
      }

      router.replace('/home');
    } catch (error) {
      console.log('Error login:', error);
      Alert.alert('Error', 'Ocurrió un problema al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#05040a', '#11101c', '#05040a']} style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.logo, { transform: [{ scale: logoScale }] }]}>
          <Text style={styles.logoText}>C</Text>
        </Animated.View>

        <Text style={styles.brand}>Chattera</Text>
        <Text style={styles.subtitle}>Conectá con personas en vivo</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Iniciar sesión</Text>

          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor="#9b8b64"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            placeholder="Contraseña"
            placeholderTextColor="#9b8b64"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Pressable onPress={handleLogin} disabled={loading} style={styles.buttonWrap}>
            <LinearGradient colors={['#ffe28a', '#d6a935', '#8f5f10']} style={styles.button}>
              <Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.replace('/register')} disabled={loading}>
            <Text style={styles.link}>
              ¿No tienes cuenta? <Text style={styles.linkGold}>Regístrate</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 226, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 226, 138, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffd76a',
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 8,
  },
  logoText: {
    color: '#ffe28a',
    fontSize: 40,
    fontWeight: '900',
  },
  brand: {
    color: '#ffe28a',
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 18,
  },
  subtitle: {
    color: '#a99b79',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  card: {
    backgroundColor: 'rgba(18, 17, 28, 0.96)',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 226, 138, 0.18)',
  },
  title: {
    color: '#fff2c2',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 18,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 226, 138, 0.12)',
  },
  buttonWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
  },
  button: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#170f04',
    fontSize: 17,
    fontWeight: '900',
  },
  link: {
    color: '#9a96a6',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 15,
  },
  linkGold: {
    color: '#ffe28a',
    fontWeight: '800',
  },
});