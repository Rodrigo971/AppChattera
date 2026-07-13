import { useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');

  const handleReset = async () => {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    Alert.alert('Error', 'Ingresá tu correo');
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: 'chattera://reset-password',
  });

  if (error) {
    Alert.alert('Error', error.message);
    return;
  }

  Alert.alert(
    'Correo enviado',
    'Revisá tu bandeja de entrada y la carpeta de spam para cambiar la contraseña.'
  );
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recuperar contraseña</Text>

      <TextInput
        placeholder="Correo electrónico"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <Pressable style={styles.button} onPress={handleReset}>
        <Text style={styles.buttonText}>Enviar correo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: '#D4AF37',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#D4AF37',
    padding: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: '#000',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});