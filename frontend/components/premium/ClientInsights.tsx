import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { premium } from '../../theme/premium';

type EmpresaRank = { empresa_id?: string; nome: string; vencidas?: number; pagas?: number };

export function ClientInsights({
  insights,
}: {
  insights: {
    mais_atrasam?: EmpresaRank[];
    mais_organizadas?: EmpresaRank[];
    media_dias_pagamento?: number;
    total_empresas?: number;
  };
}) {
  if (!insights) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Relatório de clientes</Text>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Média de dias vs. vencimento</Text>
        <Text style={styles.statVal}>{insights.media_dias_pagamento ?? 0} dias</Text>
      </View>
      <Text style={styles.statLabel}>{insights.total_empresas ?? 0} empresas ativas</Text>

      {insights.mais_atrasam?.length ? (
        <>
          <Text style={styles.sub}>Mais atrasam</Text>
          {insights.mais_atrasam.map((e) => (
            <View key={e.empresa_id || e.nome} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {e.nome}
              </Text>
              <Text style={styles.bad}>{e.vencidas} vencida(s)</Text>
            </View>
          ))}
        </>
      ) : null}

      {insights.mais_organizadas?.length ? (
        <>
          <Text style={[styles.sub, { marginTop: 12 }]}>Mais organizadas</Text>
          {insights.mais_organizadas.map((e) => (
            <View key={e.empresa_id || e.nome} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {e.nome}
              </Text>
              <Text style={styles.good}>{e.pagas} paga(s)</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: premium.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: premium.border,
    ...premium.shadow,
  },
  title: { fontSize: 16, fontWeight: '800', color: premium.text, marginBottom: 12 },
  sub: { fontSize: 12, fontWeight: '700', color: premium.textMuted, marginBottom: 8, marginTop: 4 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statLabel: { fontSize: 12, color: premium.textMuted },
  statVal: { fontSize: 14, fontWeight: '800', color: premium.primary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: premium.border,
  },
  name: { flex: 1, fontSize: 13, color: premium.text, fontWeight: '600', marginRight: 8 },
  bad: { fontSize: 12, fontWeight: '700', color: premium.status.vencida.main },
  good: { fontSize: 12, fontWeight: '700', color: premium.status.paga.main },
});
