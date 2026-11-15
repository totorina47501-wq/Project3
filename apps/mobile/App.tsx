import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  buildMentioncheckUrl,
  DEFAULT_ALLOWED_ORIGINS,
  normalizeBaseUrl,
  isAllowedMentioncheckUrl,
  getSafeExternalUrl,
} from './src/security/allowed-web-url';

type MobileTab = {
  id: string;
  label: string;
  path: string;
};

const TABS: MobileTab[] = [
  { id: 'login', label: 'Connexion', path: '/login' },
  { id: 'dashboard', label: 'Tableau de bord', path: '/dashboard' },
  { id: 'check', label: 'Verifier', path: '/dashboard/check' },
  { id: 'archive', label: 'Historique', path: '/dashboard/archive' },
  { id: 'mia', label: 'Mia', path: '/dashboard/mia' },
  { id: 'studio', label: 'Studio', path: '/dashboard/studio' },
  { id: 'account', label: 'Compte', path: '/dashboard/settings' },
];

export default function App() {
  const baseOrigin = useMemo(
    () => normalizeBaseUrl(process.env.EXPO_PUBLIC_MENTIONCHECK_BASE_URL),
    [],
  );
  const allowedOrigins = DEFAULT_ALLOWED_ORIGINS;

  const [activeTabId, setActiveTabId] = useState<string>(TABS[1].id);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];
  const targetUrl = buildMentioncheckUrl(baseOrigin, activeTab.path);

  const legalPolicyUrl = buildMentioncheckUrl(baseOrigin, '/legal/confidentialite');
  const legalTermsUrl = buildMentioncheckUrl(baseOrigin, '/legal/cgu');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>MentionCheck mobile</Text>
        <Text style={styles.subtitle}>
          MVP Android/iOS base sur le backend existant. OAuth social: YouTube uniquement.
        </Text>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.tabRow} showsHorizontalScrollIndicator={false}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir ${tab.label}`}
            style={[styles.tab, tab.id === activeTab.id ? styles.tabActive : null]}
            onPress={() => {
              setNotice(null);
              setActiveTabId(tab.id);
            }}
          >
            <Text style={[styles.tabText, tab.id === activeTab.id ? styles.tabTextActive : null]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.webViewWrapper}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Chargement en cours...</Text>
          </View>
        ) : null}
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: targetUrl }}
          originWhitelist={allowedOrigins}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          allowsBackForwardNavigationGestures
          onLoadStart={() => {
            setLoading(true);
            setNetworkError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setNetworkError(true);
          }}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
          onShouldStartLoadWithRequest={(request) => {
            if (!request.url) return false;
            if (isAllowedMentioncheckUrl(request.url, allowedOrigins)) {
              return true;
            }
            const externalUrl = getSafeExternalUrl(request.url);
            if (!externalUrl) {
              setNotice('Lien non sécurisé bloqué.');
              return false;
            }
            // Ne jamais afficher l'URL complète : elle peut contenir code OAuth ou token.
            setNotice(`Lien externe : ${new URL(externalUrl).hostname}`);
            void Linking.openURL(externalUrl).catch(() => {
              setNotice('Ouverture du lien externe impossible.');
            });
            return false;
          }}
        />
        {networkError ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>Connexion indisponible.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setNetworkError(false);
                setWebViewKey((value) => value + 1);
              }}
            >
              <Text style={styles.footerLink}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {notice ? (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>RGPD et legal:</Text>
        <Pressable onPress={() => void Linking.openURL(legalPolicyUrl)} accessibilityRole="link">
          <Text style={styles.footerLink}>Confidentialite</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(legalTermsUrl)} accessibilityRole="link">
          <Text style={styles.footerLink}>CGU</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f7fb',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#05294b',
  },
  subtitle: {
    fontSize: 13,
    color: '#2a4f73',
  },
  tabRow: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  tab: {
    borderWidth: 1,
    borderColor: '#b9d4ea',
    borderRadius: 100,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: '#0d5ea6',
    borderColor: '#0d5ea6',
  },
  tabText: {
    color: '#0d5ea6',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  webViewWrapper: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d5e5f3',
    overflow: 'hidden',
  },
  loadingOverlay: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
    position: 'absolute',
    top: 8,
    backgroundColor: '#ffffffea',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  loadingText: {
    color: '#35506a',
    fontSize: 12,
  },
  warningBanner: {
    backgroundColor: '#fff4e8',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0d0ad',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  warningText: {
    color: '#7a4a14',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerText: {
    color: '#35506a',
    fontSize: 12,
  },
  footerLink: {
    color: '#0d5ea6',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
