import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/design/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      tabBar={(props) => <FloatingTabBar {...(props as unknown as Parameters<typeof FloatingTabBar>[0])} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="items" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
