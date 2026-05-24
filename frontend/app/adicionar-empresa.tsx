import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { empresasAPI, cnpjAPI } from '../services/api';
import { formatCNPJ } from '../utils/formatters';
import { useToast } from '../contexts/ToastContext';

export default function AdicionarEmpresaScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [empresaData, setEmpresaData] = useState<any>(null);

  const handleSearchCNPJ = async () => {
    if (!cnpj.trim()) {
      showToast('Digite um CNPJ', 'error');
      return;
    }

    setSearching(true);
    try {
      const response = await cnpjAPI.buscar(cnpj);
      setEmpresaData(response.data);
      showToast('Dados do CNPJ encontrados!', 'info');
    } catch (error: any) {
      console.error('Erro ao buscar CNPJ:', error);
      if (error.response?.status === 404) {
        showToast('CNPJ não encontrado', 'error');
      } else {
        showToast('Não foi possível buscar os dados do CNPJ', 'error');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!empresaData) {
      showToast('Busque os dados do CNPJ primeiro', 'error');
      return;
    }

    setLoading(true);
    try {
      await empresasAPI.criar({ cnpj });
      
      showToast('Empresa cadastrada com sucesso!', 'success');
      
      // Redirect after showing toast
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao cadastrar empresa:', error);
      setLoading(false);
      if (error.response?.status === 400) {
        showToast('Esta empresa já está cadastrada', 'error');
      } else {
        showToast('Não foi possível cadastrar a empresa', 'error');
      }
    }
  };

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
          <Text style={styles.headerTitle}>Adicionar Empresa</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Informação */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={24} color="#3B82F6" />
              <Text style={styles.infoText}>
                Digite o CNPJ da empresa para buscar automaticamente os dados
                cadastrais
              </Text>
            </View>

            {/* Input CNPJ */}
            <View style={styles.field}>
              <Text style={styles.label}>CNPJ</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="00.000.000/0000-00"
                  keyboardType="number-pad"
                  value={cnpj}
                  onChangeText={setCnpj}
                  maxLength={18}
                />
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearchCNPJ}
                  disabled={searching}
                >
                  {searching ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Ionicons name="search" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Dados da Empresa */}
            {empresaData && (
              <View style={styles.empresaCard}>
                <View style={styles.empresaHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="business" size={32} color="#3B82F6" />
                  </View>
                </View>

                <View style={styles.empresaInfo}>
                  <Text style={styles.empresaNome}>
                    {empresaData.razao_social}
                  </Text>
                  {empresaData.nome_fantasia && (
                    <Text style={styles.empresaFantasia}>
                      {empresaData.nome_fantasia}
                    </Text>
                  )}
                  <View style={styles.cnpjBadge}>
                    <Ionicons name="document-text" size={16} color="#6B7280" />
                    <Text style={styles.cnpjText}>
                      {formatCNPJ(empresaData.cnpj)}
                    </Text>
                  </View>
                </View>

                {empresaData.dados_completos?.address && (
                  <View style={styles.addressContainer}>
                    <Ionicons name="location" size={16} color="#6B7280" />
                    <Text style={styles.addressText}>
                      {empresaData.dados_completos.address.street},{' '}
                      {empresaData.dados_completos.address.number} -{' '}
                      {empresaData.dados_completos.address.city}/
                      {empresaData.dados_completos.address.state}
                    </Text>
                  </View>
                )}

                <View style={styles.statusBadge}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          empresaData.dados_completos?.status?.text ===
                          'ATIVA'
                            ? '#10B981'
                            : '#EF4444',
                      },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {empresaData.dados_completos?.status?.text || 'Desconhecido'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Botão de Salvar */}
        {empresaData && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Cadastrar Empresa</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    padding: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
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
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empresaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  empresaHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empresaInfo: {
    marginBottom: 16,
  },
  empresaNome: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  empresaFantasia: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  cnpjBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  cnpjText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#1F2937',
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
