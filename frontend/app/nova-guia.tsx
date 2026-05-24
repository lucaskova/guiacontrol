import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { empresasAPI, guiasAPI } from '../services/api';
import { formatCNPJ } from '../utils/formatters';
import { FileUpload } from '../components/FileUpload';
import { useToast } from '../contexts/ToastContext';

const TIPOS_GUIA = [
  { label: 'GA', value: 'GA' },
  { label: 'DAS', value: 'DAS' },
  { label: 'DARF', value: 'DARF' },
  { label: 'ICMS', value: 'ICMS' },
  { label: 'ISS', value: 'ISS' },
  { label: 'INSS', value: 'INSS' },
  { label: 'FGTS', value: 'FGTS' },
  { label: 'GPS', value: 'GPS' },
  { label: 'GRU', value: 'GRU' },
  { label: 'GARE', value: 'GARE' },
  { label: 'DAE', value: 'DAE' },
  { label: 'Outros', value: 'OUTROS' },
];

// Helper to format valor input as Brazilian currency
const formatValorInput = (text: string): string => {
  // Remove everything except digits and comma
  let cleaned = text.replace(/[^\d,]/g, '');
  // Only allow one comma
  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts[0] + ',' + parts.slice(1).join('');
  }
  // Limit decimal places to 2
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + ',' + parts[1].substring(0, 2);
  }
  return cleaned;
};

// Convert Brazilian format value to float
const parseValorBR = (valor: string): number => {
  if (!valor) return 0;
  // Remove dots (thousand separator) and replace comma with dot
  const cleaned = valor.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Format date input as DD/MM/YYYY
const formatDateInput = (text: string): string => {
  // Remove non-digits
  const digits = text.replace(/\D/g, '');
  // Apply mask
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

// Convert DD/MM/YYYY to YYYY-MM-DD for the API
const convertDateToISO = (dateStr: string): string => {
  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Convert DD/MM/YYYY
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr; // Return as-is if no match
};

export default function NovaGuiaScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    empresa_id: '',
    tipo: 'DAS',
    descricao: '',
    valor: '',
    data_vencimento: '',
    codigo_barras: '',
    qr_code_pix: '',
    observacoes: '',
  });

  const [arquivoGuia, setArquivoGuia] = useState<string | null>(null);

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      const response = await empresasAPI.listar();
      setEmpresas(response.data);
      if (response.data.length > 0) {
        setFormData((prev) => ({ ...prev, empresa_id: response.data[0].empresa_id }));
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      showToast('Não foi possível carregar as empresas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOCRComplete = (dados: any) => {
    console.log('📊 OCR dados recebidos no formulário:', dados);
    
    setFormData((prev) => {
      const updated = { ...prev };
      
      if (dados.valor != null && dados.valor !== undefined) {
        // Format the value as Brazilian currency string
        updated.valor = dados.valor.toString().replace('.', ',');
        console.log('✅ Valor preenchido:', updated.valor);
      }
      if (dados.data_vencimento) {
        // OCR returns DD/MM/YYYY format - keep it for the masked input
        updated.data_vencimento = dados.data_vencimento;
        console.log('✅ Data preenchida:', updated.data_vencimento);
      }
      if (dados.codigo_barras) {
        updated.codigo_barras = dados.codigo_barras;
        console.log('✅ Código de barras preenchido:', updated.codigo_barras);
      }
      if (dados.qr_code_pix) {
        updated.qr_code_pix = dados.qr_code_pix;
        console.log('✅ QR Code PIX preenchido:', updated.qr_code_pix);
      }
      if (dados.descricao_sugerida) {
        updated.descricao = dados.descricao_sugerida;
        console.log('✅ Descrição preenchida:', updated.descricao);
      }
      if (dados.tipo_documento) {
        updated.tipo = dados.tipo_documento;
        console.log('✅ Tipo preenchido:', updated.tipo);
      }
      
      return updated;
    });
  };

  const handleSubmit = async () => {
    // Validação
    if (!formData.empresa_id) {
      showToast('Selecione uma empresa', 'error');
      return;
    }
    if (!formData.descricao.trim()) {
      showToast('Informe a descrição da guia', 'error');
      return;
    }
    
    const valorFloat = parseValorBR(formData.valor);
    if (!formData.valor || valorFloat <= 0) {
      showToast('Informe um valor válido', 'error');
      return;
    }
    if (!formData.data_vencimento) {
      showToast('Informe a data de vencimento', 'error');
      return;
    }

    // Validate date format
    const dateStr = formData.data_vencimento.trim();
    const isValidDate = /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr) || /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (!isValidDate) {
      showToast('Data inválida. Use o formato DD/MM/AAAA', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const guiaData: any = {
        empresa_id: formData.empresa_id,
        tipo: formData.tipo,
        descricao: formData.descricao,
        valor: valorFloat,
        data_vencimento: convertDateToISO(dateStr),
        codigo_barras: formData.codigo_barras || null,
        qr_code_pix: formData.qr_code_pix || null,
        observacoes: formData.observacoes || null,
      };
      
      // Adicionar arquivo se houver
      if (arquivoGuia) {
        guiaData.arquivo_guia = arquivoGuia;
      }
      
      console.log('📤 Enviando guia:', { ...guiaData, arquivo_guia: guiaData.arquivo_guia ? '[BASE64]' : null });
      
      await guiasAPI.criar(guiaData);
      
      showToast('Guia cadastrada com sucesso!', 'success');
      
      // Redirect after a short delay so the user sees the toast
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao criar guia:', error);
      setSubmitting(false);
      const msg = error?.response?.data?.detail || 'Não foi possível cadastrar a guia';
      showToast(msg, 'error');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (empresas.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova Guia</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>
            Você precisa cadastrar uma empresa primeiro
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/adicionar-empresa')}
          >
            <Text style={styles.emptyButtonText}>Adicionar Empresa</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova Guia</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.form}>
            {/* Empresa */}
            <View style={styles.field}>
              <Text style={styles.label}>Empresa *</Text>
              <View style={styles.pickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {empresas.map((empresa) => (
                    <TouchableOpacity
                      key={empresa.empresa_id}
                      style={[
                        styles.empresaChip,
                        formData.empresa_id === empresa.empresa_id &&
                          styles.empresaChipActive,
                      ]}
                      onPress={() =>
                        setFormData((prev) => ({
                          ...prev,
                          empresa_id: empresa.empresa_id,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.empresaChipText,
                          formData.empresa_id === empresa.empresa_id &&
                            styles.empresaChipTextActive,
                        ]}
                      >
                        {empresa.nome_fantasia || empresa.razao_social}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Tipo */}
            <View style={styles.field}>
              <Text style={styles.label}>Tipo *</Text>
              <View style={styles.tiposContainer}>
                {TIPOS_GUIA.map((tipo) => (
                  <TouchableOpacity
                    key={tipo.value}
                    style={[
                      styles.tipoChip,
                      formData.tipo === tipo.value && styles.tipoChipActive,
                    ]}
                    onPress={() =>
                      setFormData((prev) => ({ ...prev, tipo: tipo.value }))
                    }
                  >
                    <Text
                      style={[
                        styles.tipoChipText,
                        formData.tipo === tipo.value && styles.tipoChipTextActive,
                      ]}
                    >
                      {tipo.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Descrição */}
            <View style={styles.field}>
              <Text style={styles.label}>Descrição *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: DAS referente a Maio/2025"
                value={formData.descricao}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, descricao: text }))
                }
              />
            </View>

            {/* Valor */}
            <View style={styles.field}>
              <Text style={styles.label}>Valor (R$) *</Text>
              <View style={styles.valorContainer}>
                <Text style={styles.valorPrefix}>R$</Text>
                <TextInput
                  style={styles.valorInput}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  value={formData.valor}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, valor: formatValorInput(text) }))
                  }
                />
              </View>
            </View>

            {/* Data de Vencimento */}
            <View style={styles.field}>
              <Text style={styles.label}>Data de Vencimento *</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                value={formData.data_vencimento}
                onChangeText={(text) => {
                  // Only apply mask for manual typing, not for OCR auto-fill
                  const formatted = formatDateInput(text);
                  setFormData((prev) => ({ ...prev, data_vencimento: formatted }));
                }}
                maxLength={10}
              />
            </View>

            {/* Código de Barras */}
            {formData.codigo_barras ? (
              <View style={styles.field}>
                <Text style={styles.label}>Código de Barras <Text style={styles.ocrTag}>● Preenchido pelo OCR</Text></Text>
                <View style={styles.ocrFilledBox}>
                  <Ionicons name="barcode" size={20} color="#1E40AF" />
                  <Text style={styles.ocrFilledText} numberOfLines={2}>{formData.codigo_barras}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={styles.label}>Código de Barras</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite o código de barras"
                  value={formData.codigo_barras}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, codigo_barras: text }))
                  }
                />
              </View>
            )}

            {/* QR Code PIX */}
            {formData.qr_code_pix ? (
              <View style={styles.field}>
                <Text style={styles.label}>QR Code PIX <Text style={styles.ocrTag}>● Preenchido pelo OCR</Text></Text>
                <View style={styles.ocrFilledBox}>
                  <Ionicons name="qr-code" size={20} color="#1E40AF" />
                  <Text style={styles.ocrFilledText} numberOfLines={2}>{formData.qr_code_pix.substring(0, 60)}...</Text>
                </View>
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={styles.label}>QR Code PIX (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Cole o código PIX aqui"
                  value={formData.qr_code_pix}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, qr_code_pix: text }))
                  }
                />
              </View>
            )}

            {/* Upload da Guia com OCR */}
            <FileUpload
              label="📎 Anexar Arquivo da Guia (Opcional)"
              onFileSelect={(base64, fileName, fileType) => {
                setArquivoGuia(base64);
              }}
              onOCRComplete={handleOCRComplete}
              currentFile={arquivoGuia || undefined}
              enableOCR={true}
            />

            {/* Observações */}
            <View style={styles.field}>
              <Text style={styles.label}>Observações</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Observações adicionais"
                value={formData.observacoes}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, observacoes: text }))
                }
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        </ScrollView>

        {/* Botão de Salvar */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Salvar Guia</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  valorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  valorPrefix: {
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
  },
  valorInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    marginTop: 8,
  },
  empresaChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  empresaChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  empresaChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  empresaChipTextActive: {
    color: '#3B82F6',
  },
  tiposContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipoChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tipoChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  tipoChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tipoChipTextActive: {
    color: '#3B82F6',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ocrTag: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  ocrFilledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#1E40AF',
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  ocrFilledText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});
