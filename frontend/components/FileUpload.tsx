import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { ocrAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { OcrInteligencia } from './premium/OcrInteligencia';

interface OCRData {
  valor?: number;
  data_vencimento?: string;
  codigo_barras?: string;
  qr_code_pix?: string;
}

interface FileUploadProps {
  onFileSelect: (base64: string, fileName: string, fileType: string) => void;
  onOCRComplete?: (data: OCRData) => void;
  label: string;
  accept?: string[];
  currentFile?: string;
  enableOCR?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onOCRComplete,
  label,
  accept = ['application/pdf', 'image/jpeg', 'image/png'],
  currentFile,
  enableOCR = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [ocrDone, setOcrDone] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<string | null>(currentFile || null);
  const { showToast } = useToast();

  const processOCR = async (base64Data: string) => {
    if (!enableOCR || !onOCRComplete) return;

    setProcessingOCR(true);
    setOcrDone({});
    try {
      const response = await ocrAPI.processar(base64Data);
      const dados = response.data;
      
      console.log('📊 Dados OCR extraídos:', JSON.stringify(dados));
      
      // Build the OCR result
      const ocrResult: OCRData = {};
      if (dados.valor) ocrResult.valor = dados.valor;
      if (dados.data_vencimento) ocrResult.data_vencimento = dados.data_vencimento;
      if (dados.codigo_barras) ocrResult.codigo_barras = dados.codigo_barras;
      if (dados.qr_code_pix) ocrResult.qr_code_pix = dados.qr_code_pix;
      if (dados.competencia) (ocrResult as any).competencia = dados.competencia;
      if (dados.tipo_documento) (ocrResult as any).tipo_documento = dados.tipo_documento;
      if (dados.descricao_sugerida) (ocrResult as any).descricao_sugerida = dados.descricao_sugerida;
      
      onOCRComplete(ocrResult);
      setOcrDone({
        empresa: !!(dados as any).empresa_id || !!(dados as any).cnpj,
        valor: !!dados.valor,
        vencimento: !!dados.data_vencimento,
        tipo: !!(dados as any).tipo_documento || !!(dados as any).descricao_sugerida,
      });
      
      // Show what was extracted
      const camposExtraidos = [];
      if (dados.valor) camposExtraidos.push('Valor');
      if (dados.data_vencimento) camposExtraidos.push('Data');
      if (dados.codigo_barras) camposExtraidos.push('Cód. Barras');
      if (dados.competencia) camposExtraidos.push('Competência');
      if (dados.descricao_sugerida) camposExtraidos.push('Descrição');
      if (dados.qr_code_pix) camposExtraidos.push('QR Code PIX');
      
      if (camposExtraidos.length > 0) {
        showToast(`Dados extraídos: ${camposExtraidos.join(', ')}`, 'success');
      } else {
        showToast('Não foi possível extrair dados. Preencha manualmente.', 'error');
      }
    } catch (error) {
      console.error('❌ Erro ao processar OCR:', error);
      showToast('Erro ao processar imagem. Preencha manualmente.', 'error');
    } finally {
      setTimeout(() => setProcessingOCR(false), 1200);
    }
  };

  const pickDocument = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: accept,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const asset = result.assets[0];
      
      // Read file as base64
      let base64: string;
      
      if (Platform.OS === 'web') {
        // For web, read the file using fetch
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // result is already a data URI like "data:image/jpeg;base64,..."
            resolve(result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // For native, use FileSystem
        const rawBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        let mimeType = asset.mimeType || 'application/octet-stream';
        base64 = `data:${mimeType};base64,${rawBase64}`;
      }

      // Determine file type
      let fileType = 'PDF';
      const mimeType = asset.mimeType || '';
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
        fileType = 'JPG';
      } else if (mimeType.includes('png')) {
        fileType = 'PNG';
      }

      setPreview(base64);
      onFileSelect(base64, asset.name, fileType);
      
      // Process OCR for images AND PDFs
      if (enableOCR) {
        await processOCR(base64);
      }
    } catch (error) {
      console.error('Erro ao selecionar arquivo:', error);
      if (typeof window !== 'undefined') {
        alert('Não foi possível selecionar o arquivo');
      }
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de acesso à câmera para tirar fotos'
        );
        return;
      }

      setUploading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const asset = result.assets[0];
      const base64WithPrefix = `data:image/jpeg;base64,${asset.base64}`;

      setPreview(asset.uri);
      onFileSelect(base64WithPrefix, 'foto_guia.jpg', 'JPG');
      
      // Process OCR
      await processOCR(base64WithPrefix);
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto');
    } finally {
      setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de acesso à galeria para selecionar fotos'
        );
        return;
      }

      setUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const asset = result.assets[0];
      const base64WithPrefix = `data:image/jpeg;base64,${asset.base64}`;

      setPreview(asset.uri);
      onFileSelect(base64WithPrefix, 'guia.jpg', 'JPG');
      
      // Process OCR
      await processOCR(base64WithPrefix);
    } catch (error) {
      console.error('Erro ao selecionar da galeria:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      {preview && !uploading && !processingOCR && (
        <View style={styles.previewContainer}>
          {preview.includes('image') ? (
            <Image source={{ uri: preview }} style={styles.previewImage} />
          ) : (
            <View style={styles.pdfPreview}>
              <Ionicons name="document" size={48} color="#3B82F6" />
              <Text style={styles.pdfText}>PDF Anexado</Text>
            </View>
          )}
        </View>
      )}

      {processingOCR && (
        <OcrInteligencia
          active
          done={Object.keys(ocrDone).length ? ocrDone : { empresa: true, valor: true, vencimento: true, tipo: true }}
        />
      )}

      {Platform.OS === 'web' ? (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickDocument}
          disabled={uploading || processingOCR}
        >
          {uploading ? (
            <ActivityIndicator color="#3B82F6" />
          ) : (
            <>
              <Ionicons
                name={preview ? 'refresh' : 'cloud-upload'}
                size={24}
                color="#3B82F6"
              />
              <Text style={styles.uploadText}>
                {preview ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.mobileButtonsContainer}>
          <TouchableOpacity
            style={styles.mobileButton}
            onPress={takePhoto}
            disabled={uploading || processingOCR}
          >
            <Ionicons name="camera" size={20} color="#3B82F6" />
            <Text style={styles.mobileButtonText}>Câmera</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.mobileButton}
            onPress={pickFromGallery}
            disabled={uploading || processingOCR}
          >
            <Ionicons name="images" size={20} color="#3B82F6" />
            <Text style={styles.mobileButtonText}>Galeria</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.mobileButton}
            onPress={pickDocument}
            disabled={uploading || processingOCR}
          >
            <Ionicons name="document" size={20} color="#3B82F6" />
            <Text style={styles.mobileButtonText}>Arquivo</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hint}>
        {enableOCR 
          ? 'Envie uma imagem (JPG, PNG) ou PDF para extrair dados automaticamente'
          : 'Formatos aceitos: PDF, JPG, PNG'
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  previewContainer: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    backgroundColor: '#F3F4F6',
  },
  pdfPreview: {
    width: '100%',
    height: 150,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfText: {
    fontSize: 14,
    color: '#3B82F6',
    marginTop: 8,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  mobileButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  mobileButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  mobileButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  ocrProcessing: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  ocrText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
  },
  ocrSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});
