import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { PremiumTabBar } from '../../components/premium/PremiumTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 96 : 88,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="guias" options={{ title: 'Guias' }} />
      <Tabs.Screen name="empresas" options={{ title: 'Empresas' }} />
      <Tabs.Screen name="notificacoes" options={{ title: 'Alertas' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
