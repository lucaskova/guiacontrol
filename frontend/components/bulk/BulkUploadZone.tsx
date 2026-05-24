import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

export type PickedBulkFile = {
  id: string;
  name: string;
  base64: string;
  mime: string;
  fileType: string;
};

type Props = {
  onFilesPicked: (files: PickedBulkFile[]) => void;
  disabled?: boolean;
  loading?: boolean;
};

const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

async function readFileAsDataUrl(uri: string, mime: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const FileSystem = await import('expo-file-system');
  const raw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mime};base64,${raw}`;
}

function mimeToFileType(mime: string): string {
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('png')) return 'PNG';
  return 'JPG';
}

export function BulkUploadZone({ onFilesPicked, disabled, loading }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const processAssets = async (
    assets: { uri: string; name: string; mimeType?: string }[],
  ) => {
    const out: PickedBulkFile[] = [];
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const mime = a.mimeType || 'application/octet-stream';
      const base64 = await readFileAsDataUrl(a.uri, mime);
      out.push({
        id: `f_${Date.now()}_${i}`,
        name: a.name || `guia_${i + 1}`,
        base64,
        mime,
        fileType: mimeToFileType(mime),
      });
    }
    if (out.length) onFilesPicked(out);
  };

  const pickMultiple = async () => {
    if (disabled || loading) return;
    if (Platform.OS === 'web' && inputRef.current) {
      inputRef.current.click();
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPT,
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled) return;
    await processAssets(
      result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType,
      })),
    );
  };

  const onWebInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const assets: { uri: string; name: string; mimeType?: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const uri = URL.createObjectURL(f);
      assets.push({ uri, name: f.name, mimeType: f.type });
    }
    await processAssets(assets);
    e.target.value = '';
  };

  const webDropProps =
    Platform.OS === 'web'
      ? ({
          onDragOver: (e: DragEvent) => {
            e.preventDefault();
            setDragOver(true);
          },
          onDragLeave: () => setDragOver(false),
          onDrop: async (e: DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled || loading) return;
            const files = e.dataTransfer?.files;
            if (!files?.length) return;
            const assets: { uri: string; name: string; mimeType?: string }[] = [];
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              assets.push({
                uri: URL.createObjectURL(f),
                name: f.name,
                mimeType: f.type,
              });
            }
            await processAssets(assets);
          },
        } as object)
      : {};

  return (
    <View
      style={[
        styles.zone,
        dragOver && styles.zoneDrag,
        (disabled || loading) && styles.zoneDisabled,
      ]}
      {...webDropProps}
    >
      {Platform.OS === 'web' && (
        // @ts-expect-error web input
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT.join(',')}
          style={{ display: 'none' }}
          onChange={onWebInputChange}
        />
      )}
      <View style={styles.iconWrap}>
        {loading ? (
          <ActivityIndicator size="large" color="#4F46E5" />
        ) : (
          <Ionicons name="cloud-upload" size={40} color="#4F46E5" />
        )}
      </View>
      <Text style={styles.title}>Importação inteligente em lote</Text>
      <Text style={styles.sub}>
        Arraste PDFs e imagens aqui ou selecione vários arquivos de uma vez
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={pickMultiple}
        disabled={disabled || loading}
      >
        <Ionicons name="folder-open" size={18} color="#FFF" />
        <Text style={styles.btnText}>Selecionar arquivos</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>PDF, JPG, PNG — OCR automático com IA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C7D2FE',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
  },
  zoneDrag: {
    borderColor: '#4F46E5',
    backgroundColor: '#E0E7FF',
  },
  zoneDisabled: { opacity: 0.6 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1E1B4B', marginBottom: 6 },
  sub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  hint: { marginTop: 12, fontSize: 12, color: '#94A3B8' },
});
