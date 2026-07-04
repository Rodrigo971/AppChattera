import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Screen() {
  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Volver</Text>
      </Pressable>

      <Text style={styles.title}>Pantalla en construcción</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090D',
    padding: 24,
    paddingTop: 60,
  },
  back: {
    color: '#D9A85C',
    fontSize: 16,
    marginBottom: 30,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
});