// src/services/reportPdf.js — v4.0 (Unified React-PDF Engine)
// Professionally styled reports with embedded Clinical Recovery Protocols.

import React from 'react';
import { renderToBuffer, Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';

// ── Register Google Font (Inter) ──────────────────────────────────────────────
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700 }
  ]
});

// ── Styles ───────────────────────────────────────────────────────────────────
const colors = {
  dark: '#0f172a',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#3b82f6',
  riskWatch: '#16a34a',
  riskPre: '#ea580c',
  riskAcute: '#dc2626',
  bgLight: '#f8fafc',
  white: '#ffffff',
  recovery: '#eff6ff'
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Inter', fontSize: 10, color: colors.text, lineHeight: 1.5 },
  headerBar: { backgroundColor: colors.dark, padding: 16, marginBottom: 16, borderRadius: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: 700 },
  headerSub: { color: '#94a3b8', fontSize: 8, marginTop: 2 },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3, alignSelf: 'center' },
  riskBadgeText: { color: colors.white, fontSize: 9, fontWeight: 700 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: colors.dark, marginBottom: 4, marginTop: 12 },
  sectionBody: { fontSize: 10, color: colors.text, lineHeight: 1.6 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: colors.border, marginVertical: 8 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { fontWeight: 600, width: 140, color: colors.muted, fontSize: 9 },
  value: { flex: 1, fontSize: 9.5 },
  bulletItem: { flexDirection: 'row', marginLeft: 8, marginBottom: 2 },
  bulletDot: { width: 12, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9.5 },
  card: { backgroundColor: colors.bgLight, borderRadius: 4, padding: 8, marginBottom: 6, borderWidth: 0.5, borderColor: colors.border },
  recoveryBox: { backgroundColor: colors.recovery, borderRadius: 4, padding: 12, marginTop: 8, borderWidth: 0.5, borderColor: '#bfdbfe' },
  recoveryTitle: { fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 6 },
  recoverySub: { fontSize: 9, fontWeight: 600, color: '#1d4ed8', marginTop: 4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7, color: colors.muted, textAlign: 'center' }
});

// ── Components ───────────────────────────────────────────────────────────────

const SectionTitle = ({ number, children }) => (
  <Text style={styles.sectionTitle}>{number}. {children}</Text>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value || 'N/A'}</Text>
  </View>
);

const Bullet = ({ children }) => (
  <View style={styles.bulletItem}>
    <Text style={styles.bulletDot}>  •</Text>
    <Text style={styles.bulletText}>{children}</Text>
  </View>
);

const RecoveryProtocol = ({ protocol }) => {
  if (!protocol) return null;
  return (
    <View style={styles.recoveryBox}>
      <Text style={styles.recoveryTitle}>7. Clinical Recovery Protocol</Text>
      
      <Text style={styles.recoverySub}>Primary Assessment:</Text>
      <Text style={styles.sectionBody}>{protocol.diagnosis_baseline}</Text>
      
      <Text style={styles.recoverySub}>Neuro-Dietary Protocol:</Text>
      {(protocol.neuro_diet_plan || []).map((item, i) => (
        <Bullet key={i}>{item}</Bullet>
      ))}

      <Text style={styles.recoverySub}>Somatic Exercise Regimen:</Text>
      <Text style={styles.sectionBody}>{protocol.somatic_exercise_plan}</Text>

      <Text style={[styles.sectionBody, { marginTop: 6, fontWeight: 600 }]}>
        Confidence Anchor: <Text style={{fontWeight: 400}}>{protocol.confidence_anchor}</Text>
      </Text>

      <Text style={{ fontSize: 7, color: colors.muted, marginTop: 8, fontStyle: 'italic' }}>
        * {protocol.medical_disclaimer}
      </Text>
    </View>
  );
};

// ── Document Definition ──────────────────────────────────────────────────────

const ClinicalReportDocument = ({ report }) => {
  const generatedAt = new Date(report.meta?.generatedAt || report.createdAt || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short'
  });

  const riskColor = level => {
    if (level === 'acute-distress') return colors.riskAcute;
    if (level === 'pre-burnout') return colors.riskPre;
    return colors.riskWatch;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>AuraOS Clinical Triage Report</Text>
            <Text style={styles.headerSub}>Generated: {generatedAt}  |  Report ID: {report._id || 'N/A'}</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: riskColor(report.riskLevel) }]}>
            <Text style={styles.riskBadgeText}>{(report.riskLevel || 'WATCH').toUpperCase()}</Text>
          </View>
        </View>

        <SectionTitle number={1}>Session Context</SectionTitle>
        <InfoRow label="Patient ID" value={String(report.userId).slice(0, 12)} />
        <InfoRow label="Current Task" value={report.currentTask} />
        <InfoRow label="Blocker" value={report.selectedBlocker} />
        <InfoRow label="Vocal Arousal" value={`${Number(report.vocalArousalScore || 0).toFixed(1)} / 10`} />
        
        <View style={styles.divider} />

        <SectionTitle number={2}>Session Query</SectionTitle>
        <Text style={styles.sectionBody}>{report.initialAnxietyQuery || 'No direct query captured.'}</Text>
        
        <View style={styles.divider} />

        <SectionTitle number={3}>Identified Worry Blocks</SectionTitle>
        {(report.shatteredWorryBlocks || []).map((w, i) => (
          <Bullet key={i}>"{w.text}" - weight {w.weight}/10</Bullet>
        ))}

        <SectionTitle number={4}>Task Timeline</SectionTitle>
        {(report.timelineMicroquests || []).map((q, i) => (
          <Bullet key={i}>[{q.completed ? '✓' : '○'}] {q.action} (~{q.duration_minutes}m)</Bullet>
        ))}

        <View style={styles.divider} />

        <SectionTitle number={5}>AI Clinical Summary</SectionTitle>
        <Text style={styles.sectionBody}>{report.aiStressSummary}</Text>

        {report.recoveryProtocol && <RecoveryProtocol protocol={report.recoveryProtocol} />}

        <View style={styles.divider} />

        <SectionTitle number={6}>Guardian Contact</SectionTitle>
        <InfoRow label="Guardian" value={report.guardian?.name} />
        <InfoRow label="Contact" value={report.guardian?.phone || report.guardian?.email} />

        <Text style={styles.footer}>
          This report is generated by AuraOS to support informed caregiving. Not a medical diagnosis. 
          AuraOS - Neuroscience Powered Support.
        </Text>
      </Page>
    </Document>
  );
};

// ── Export ───────────────────────────────────────────────────────────────────

export const buildClinicalReportPdfBuffer = async report => {
  return await renderToBuffer(<ClinicalReportDocument report={report} />);
};
