import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type CoinPackage = {
  id: string;
  name: string;
  coins: number;
  bonus_coins: number;
  price_usd: number | string;
  google_play_product_id: string | null;
  position: number;
};

const COLORS = {
  background: '#07090D',
  card: '#10131A',
  cardSoft: '#151922',
  gold: '#D9A85C',
  goldLight: '#FFE29A',
  goldDark: '#8B6227',
  white: '#FFFFFF',
  muted: '#A9AFBD',
  border: 'rgba(217, 168, 92, 0.28)',
  success: '#74D99F',
  danger: '#FF7B7B',
};

export default function CoinsScreen() {
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null
  );

  const loadStore = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        Alert.alert(
          'Sesión requerida',
          'Debes iniciar sesión para ver y comprar monedas.'
        );
        router.replace('/login');
        return;
      }

      const [profileResult, packagesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('coins')
          .eq('id', user.id)
          .single(),

        supabase
          .from('coin_packages')
          .select(
            'id, name, coins, bonus_coins, price_usd, google_play_product_id, position'
          )
          .eq('is_active', true)
          .order('position', { ascending: true }),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (packagesResult.error) {
        throw packagesResult.error;
      }

      setBalance(Number(profileResult.data?.coins ?? 0));

      const normalizedPackages: CoinPackage[] = (packagesResult.data ?? []).map(
        (item) => ({
          ...item,
          coins: Number(item.coins ?? 0),
          bonus_coins: Number(item.bonus_coins ?? 0),
          position: Number(item.position ?? 0),
        })
      );

      setPackages(normalizedPackages);
    } catch (error: any) {
      console.error('Error loading coin store:', error);

      Alert.alert(
        'No se pudo cargar la tienda',
        error?.message ?? 'Inténtalo nuevamente.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStore(true);
    }, [loadStore])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadStore(false);
  };

  const handleBuy = (coinPackage: CoinPackage) => {
    setSelectedPackageId(coinPackage.id);

    Alert.alert(
      'Compra próximamente',
      `Seleccionaste ${formatNumber(
        coinPackage.coins + coinPackage.bonus_coins
      )} monedas.\n\nLa compra real se habilitará mediante Google Play Billing.`,
      [
        {
          text: 'Entendido',
          onPress: () => setSelectedPackageId(null),
        },
      ]
    );
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-UY').format(value);
  };

  const formatPrice = (value: number | string) => {
    const numericPrice = Number(value);

    if (Number.isNaN(numericPrice)) {
      return String(value);
    }

    return `US$ ${numericPrice.toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

        <View style={styles.loadingLogo}>
          <Text style={styles.loadingLogoText}>C</Text>
        </View>

        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Cargando tienda premium...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
          />
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>CHATTERA PREMIUM</Text>
            <Text style={styles.headerTitle}>Tienda de monedas</Text>
          </View>

          <Pressable
            onPress={handleRefresh}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.refreshIcon}>↻</Text>
          </Pressable>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceDecorationOne} />
          <View style={styles.balanceDecorationTwo} />

          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>TU SALDO DISPONIBLE</Text>
              <Text style={styles.balanceValue}>
                🪙 {formatNumber(balance)}
              </Text>
            </View>

            <View style={styles.crownCircle}>
              <Text style={styles.crown}>♛</Text>
            </View>
          </View>

          <View style={styles.balanceDivider} />

          <Text style={styles.balanceDescription}>
            Usa tus monedas para enviar regalos, participar en salas y disfrutar
            de funciones especiales.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>RECARGA TU CUENTA</Text>
            <Text style={styles.sectionTitle}>Elegí un paquete</Text>
          </View>

          <View style={styles.secureBadge}>
            <Text style={styles.secureBadgeText}>🔒 Seguro</Text>
          </View>
        </View>

        {packages.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🪙</Text>
            <Text style={styles.emptyTitle}>No hay paquetes disponibles</Text>
            <Text style={styles.emptyText}>
              Actualiza la pantalla o revisa los paquetes activos en Supabase.
            </Text>
          </View>
        ) : (
          packages.map((coinPackage, index) => {
            const totalCoins =
              coinPackage.coins + coinPackage.bonus_coins;
            const isPopular =
              coinPackage.name.toLowerCase().includes('popular') || index === 1;
            const isSelected = selectedPackageId === coinPackage.id;

            return (
              <Pressable
                key={coinPackage.id}
                onPress={() => setSelectedPackageId(coinPackage.id)}
                style={({ pressed }) => [
                  styles.packageCard,
                  isPopular && styles.packageCardPopular,
                  isSelected && styles.packageCardSelected,
                  pressed && styles.packageCardPressed,
                ]}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>MÁS ELEGIDO</Text>
                  </View>
                )}

                <View style={styles.packageMain}>
                  <View style={styles.coinIconContainer}>
                    <Text style={styles.coinIcon}>🪙</Text>
                  </View>

                  <View style={styles.packageInformation}>
                    <Text style={styles.packageName}>
                      {coinPackage.name}
                    </Text>

                    <Text style={styles.packageCoins}>
                      {formatNumber(coinPackage.coins)} monedas
                    </Text>

                    {coinPackage.bonus_coins > 0 && (
                      <View style={styles.bonusBadge}>
                        <Text style={styles.bonusText}>
                          +{formatNumber(coinPackage.bonus_coins)} de regalo
                        </Text>
                      </View>
                    )}

                    <Text style={styles.totalText}>
                      Total: {formatNumber(totalCoins)} monedas
                    </Text>
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>
                      {formatPrice(coinPackage.price_usd)}
                    </Text>
                    <Text style={styles.paymentText}>Pago único</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => handleBuy(coinPackage)}
                  style={({ pressed }) => [
                    styles.buyButton,
                    isPopular && styles.buyButtonPopular,
                    pressed && styles.buyButtonPressed,
                  ]}
                >
                  <Text style={styles.buyButtonText}>Comprar paquete</Text>
                  <Text style={styles.buyButtonArrow}>→</Text>
                </Pressable>
              </Pressable>
            );
          })
        )}

        <View style={styles.informationCard}>
          <Text style={styles.informationTitle}>Información de compra</Text>

          <View style={styles.informationRow}>
            <Text style={styles.informationIcon}>✓</Text>
            <Text style={styles.informationText}>
              Las monedas se acreditarán luego de que Google Play confirme el
              pago.
            </Text>
          </View>

          <View style={styles.informationRow}>
            <Text style={styles.informationIcon}>✓</Text>
            <Text style={styles.informationText}>
              Tu saldo se guarda en tu cuenta de Chattera.
            </Text>
          </View>

          <View style={styles.informationRow}>
            <Text style={styles.informationIcon}>✓</Text>
            <Text style={styles.informationText}>
              Los botones están preparados para conectar Google Play Billing.
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Chattera Premium · Compras protegidas por Google Play
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 42,
  },

  topGlow: {
    position: 'absolute',
    top: -160,
    right: -130,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(217, 168, 92, 0.08)',
  },

  bottomGlow: {
    position: 'absolute',
    bottom: 30,
    left: -160,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(217, 168, 92, 0.05)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  headerEyebrow: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: '900',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  backIcon: {
    color: COLORS.goldLight,
    fontSize: 33,
    lineHeight: 35,
    fontWeight: '400',
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  refreshIcon: {
    color: COLORS.goldLight,
    fontSize: 21,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },

  balanceCard: {
    overflow: 'hidden',
    backgroundColor: '#17130D',
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 226, 154, 0.36)',
    marginBottom: 30,
  },

  balanceDecorationOne: {
    position: 'absolute',
    top: -70,
    right: -45,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(217, 168, 92, 0.12)',
  },

  balanceDecorationTwo: {
    position: 'absolute',
    bottom: -80,
    left: -55,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(217, 168, 92, 0.06)',
  },

  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  balanceLabel: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  balanceValue: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: '900',
  },

  crownCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 168, 92, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 226, 154, 0.38)',
  },

  crown: {
    color: COLORS.goldLight,
    fontSize: 31,
  },

  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(217, 168, 92, 0.16)',
    marginVertical: 18,
  },

  balanceDescription: {
    color: '#D2C5AD',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  sectionEyebrow: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  sectionTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '900',
  },

  secureBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(116, 217, 159, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(116, 217, 159, 0.25)',
  },

  secureBadgeText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '800',
  },

  packageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  packageCardPopular: {
    borderColor: 'rgba(217, 168, 92, 0.65)',
    backgroundColor: '#15130F',
  },

  packageCardSelected: {
    borderColor: COLORS.gold,
  },

  packageCardPressed: {
    transform: [{ scale: 0.99 }],
  },

  popularBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    marginBottom: 13,
  },

  popularBadgeText: {
    color: '#171008',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  packageMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  coinIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 168, 92, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 168, 92, 0.23)',
    marginRight: 13,
  },

  coinIcon: {
    fontSize: 29,
  },

  packageInformation: {
    flex: 1,
  },

  packageName: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  packageCoins: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '900',
  },

  bonusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(116, 217, 159, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 6,
  },

  bonusText: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: '900',
  },

  totalText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },

  priceContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  price: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
  },

  paymentText: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 4,
  },

  buyButton: {
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 15,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  buyButtonPopular: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.goldLight,
  },

  buyButtonPressed: {
    opacity: 0.75,
  },

  buyButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
  },

  buyButtonArrow: {
    color: COLORS.goldLight,
    fontSize: 20,
    fontWeight: '900',
  },

  informationCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  informationTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 14,
  },

  informationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 11,
  },

  informationIcon: {
    width: 24,
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '900',
  },

  informationText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  emptyCard: {
    padding: 30,
    borderRadius: 22,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },

  emptyTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },

  emptyText: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },

  footer: {
    color: '#6E7480',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 24,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  loadingLogo: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17130D',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
  },

  loadingLogoText: {
    color: COLORS.goldLight,
    fontSize: 35,
    fontWeight: '900',
  },

  loadingText: {
    color: COLORS.muted,
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
  },
});