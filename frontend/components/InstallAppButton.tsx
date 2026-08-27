import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInstallApp } from '../hooks/useInstallApp';

type Variant = 'card' | 'pill' | 'inline' | 'banner';

type Props = {
  variant?: Variant;
  label?: string;
  /** Cor primária (default: violet brand). */
  color?: string;
  /** Subtítulo para variant="card". */
  subtitle?: string;
  /** Mostra no portal do cliente mesmo antes do prompt nativo (iOS/Android). */
  alwaysShow?: boolean;
};

/**
 * Botão de "Instalar app" — aparece apenas no web e quando o navegador
 * indica que a instalação é possível. No iOS, mostra um modal com instruções
 * (Compartilhar → Adicionar à Tela de Início).
 */
export function InstallAppButton({
  variant = 'card',
  label = 'Instalar app',
  color = '#6D28D9',
  subtitle = 'Use offline e abra direto da tela inicial',
  alwaysShow = false,
}: Props) {
  const { canInstall, isStandalone, isIOS, inAppBrowser, install, openInChrome } = useInstallApp();
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);

  if (!alwaysShow && isStandalone) return null;
  if (!alwaysShow && !canInstall && !isIOS) return null;

  const onPress = async () => {
    const result = await install();
    if (result.outcome === 'accepted') return;
    if (inAppBrowser && !isIOS) {
      openInChrome();
      return;
    }
    if (isIOS) {
      setIosOpen(true);
      return;
    }
    setAndroidOpen(true);
  };

  const tone = { backgroundColor: color };
  const ctaLabel = canInstall ? 'Instalar' : inAppBrowser && !isIOS ? 'Abrir no Chrome' : 'Instalar';

  if (variant === 'banner') {
    return (
      <>
        <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[styles.banner, { backgroundColor: color }]}>
          <Ionicons name="download-outline" size={22} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{label}</Text>
            <Text style={styles.bannerSub}>{subtitle}</Text>
          </View>
          <Text style={styles.bannerCta}>{ctaLabel}</Text>
        </TouchableOpacity>
        <IOSHelpModal visible={iosOpen} onClose={() => setIosOpen(false)} />
        <AndroidHelpModal
          visible={androidOpen}
          onClose={() => setAndroidOpen(false)}
          inApp={inAppBrowser}
          onOpenChrome={openInChrome}
        />
      </>
    );
  }

  if (variant === 'pill') {
    return (
      <>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={[styles.pill, tone]}
        >
          <Ionicons name="download-outline" size={15} color="#FFFFFF" />
          <Text style={styles.pillText}>{ctaLabel}</Text>
        </TouchableOpacity>
        <IOSHelpModal visible={iosOpen} onClose={() => setIosOpen(false)} />
        <AndroidHelpModal
          visible={androidOpen}
          onClose={() => setAndroidOpen(false)}
          inApp={inAppBrowser}
          onOpenChrome={openInChrome}
        />
      </>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={[styles.inline, { borderColor: color + '55', backgroundColor: color + '10' }]}
        >
          <Ionicons name="download-outline" size={16} color={color} />
          <Text style={[styles.inlineText, { color }]}>{label}</Text>
        </TouchableOpacity>
        <IOSHelpModal visible={iosOpen} onClose={() => setIosOpen(false)} />
        <AndroidHelpModal
          visible={androidOpen}
          onClose={() => setAndroidOpen(false)}
          inApp={inAppBrowser}
          onOpenChrome={openInChrome}
        />
      </>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.cardWrap}>
        <View style={[styles.cardIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name="phone-portrait-outline" size={20} color={color} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{label}</Text>
          <Text style={styles.cardSub}>{subtitle}</Text>
        </View>
        <View style={[styles.cardCta, { backgroundColor: color }]}>
          <Ionicons name="download-outline" size={14} color="#FFFFFF" />
          <Text style={styles.cardCtaText}>{ctaLabel}</Text>
        </View>
      </TouchableOpacity>
      <IOSHelpModal visible={iosOpen} onClose={() => setIosOpen(false)} />
      <AndroidHelpModal
        visible={androidOpen}
        onClose={() => setAndroidOpen(false)}
        inApp={inAppBrowser}
        onOpenChrome={openInChrome}
      />
    </>
  );
}

function AndroidHelpModal({
  visible,
  onClose,
  inApp,
  onOpenChrome,
}: {
  visible: boolean;
  onClose: () => void;
  inApp?: boolean;
  onOpenChrome?: () => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: '#059669' }]}>
              <Ionicons name="logo-android" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Instalar no Android</Text>
              <Text style={styles.sheetSub}>Chrome ou Samsung Internet</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Abra o menu do navegador</Text>
              <Text style={styles.stepDesc}>Três pontos no canto superior direito</Text>
            </View>
            <Ionicons name="ellipsis-vertical" size={22} color="#059669" />
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Instalar app ou Adicionar à tela inicial</Text>
              <Text style={styles.stepDesc}>O nome pode variar conforme o navegador</Text>
            </View>
            <Ionicons name="download-outline" size={22} color="#059669" />
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Confirme a instalação</Text>
              <Text style={styles.stepDesc}>O ícone &quot;Minhas Guias&quot; aparece na tela inicial</Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color="#059669" />
          </View>

          {inApp && onOpenChrome ? (
            <TouchableOpacity
              onPress={() => {
                onOpenChrome();
                onClose();
              }}
              style={[styles.sheetButton, { backgroundColor: '#059669' }]}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetButtonText}>Abrir no Chrome para instalar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={[styles.sheetButton, { backgroundColor: '#059669' }]} activeOpacity={0.85}>
              <Text style={styles.sheetButtonText}>Entendi</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function IOSHelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetIcon}>
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Instalar no iPhone</Text>
              <Text style={styles.sheetSub}>Em 3 passos no Safari</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Toque em Compartilhar</Text>
              <Text style={styles.stepDesc}>O ícone com a seta para cima na barra de baixo do Safari</Text>
            </View>
            <Ionicons name="share-outline" size={22} color="#1E40AF" />
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Adicionar à Tela de Início</Text>
              <Text style={styles.stepDesc}>Role até encontrar essa opção</Text>
            </View>
            <Ionicons name="add-circle-outline" size={22} color="#1E40AF" />
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Toque em Adicionar</Text>
              <Text style={styles.stepDesc}>Pronto — o app aparece na sua tela</Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color="#059669" />
          </View>

          <TouchableOpacity onPress={onClose} style={styles.sheetButton} activeOpacity={0.85}>
            <Text style={styles.sheetButtonText}>Entendi</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  bannerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  bannerCta: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  inlineText: { fontSize: 13.5, fontWeight: '700' },

  cardWrap: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: '#111827' },
  cardSub: { marginTop: 1, fontSize: 12.5, color: '#6B7280' },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cardCtaText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sheetSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  stepTitle: { fontSize: 13.5, fontWeight: '700', color: '#111827' },
  stepDesc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  sheetButton: {
    marginTop: 6,
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetButtonText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
});
