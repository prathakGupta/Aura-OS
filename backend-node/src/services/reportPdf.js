// src/services/reportPdf.js — v4.1 (Unified React-PDF Engine)
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

// ── Components (Manual createElement for Node compatibility) ──────────────────

const SectionTitle = ({ number, children }) => 
  React.createElement(Text, { style: styles.sectionTitle }, `${number}. `, children);

const InfoRow = ({ label, value }) => 
  React.createElement(View, { style: styles.row },
    React.createElement(Text, { style: styles.label }, label),
    React.createElement(Text, { style: styles.value }, value || 'N/A')
  );

const Bullet = ({ children }) => 
  React.createElement(View, { style: styles.bulletItem },
    React.createElement(Text, { style: styles.bulletDot }, '  •'),
    React.createElement(Text, { style: styles.bulletText }, children)
  );

const RecoveryProtocol = ({ protocol }) => {
  if (!protocol) return null;
  return React.createElement(View, { style: styles.recoveryBox },
    React.createElement(Text, { style: styles.recoveryTitle }, '7. Clinical Recovery Protocol'),
    
    React.createElement(Text, { style: styles.recoverySub }, 'Primary Assessment:'),
    React.createElement(Text, { style: styles.sectionBody }, protocol.diagnosis_baseline),
    
    React.createElement(Text, { style: styles.recoverySub }, 'Neuro-Dietary Protocol:'),
    (protocol.neuro_diet_plan || []).map((item, i) => 
      React.createElement(Bullet, { key: i }, item)
    ),

    React.createElement(Text, { style: styles.recoverySub }, 'Somatic Exercise Regimen:'),
    React.createElement(Text, { style: styles.sectionBody }, protocol.somatic_exercise_plan),

    React.createElement(Text, { style: [styles.sectionBody, { marginTop: 6, fontWeight: 600 }] },
      'Confidence Anchor: ',
      React.createElement(Text, { style: { fontWeight: 400 } }, protocol.confidence_anchor)
    ),

    React.createElement(Text, { style: { fontSize: 7, color: colors.muted, marginTop: 8, fontStyle: 'italic' } },
      `* ${protocol.medical_disclaimer}`
    )
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

  const worries = (report.shatteredWorryBlocks || []).slice(0, 10);
  const timeline = (report.timelineMicroquests || []).sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 10);

  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: styles.page },
      // Header
      React.createElement(View, { style: styles.headerBar },
        React.createElement(View, null,
          React.createElement(Text, { style: styles.headerTitle }, "AuraOS Clinical Triage Report"),
          React.createElement(Text, { style: styles.headerSub }, `Generated: ${generatedAt}  |  Report ID: ${report._id || 'N/A'}`)
        ),
        React.createElement(View, { style: [styles.riskBadge, { backgroundColor: riskColor(report.riskLevel) }] },
          React.createElement(Text, { style: styles.riskBadgeText }, (report.riskLevel || 'WATCH').toUpperCase())
        )
      ),

      React.createElement(SectionTitle, { number: 1 }, "Session Context"),
      React.createElement(InfoRow, { label: "Patient ID", value: String(report.userId || 'N/A').slice(0, 12) }),
      React.createElement(InfoRow, { label: "Current Task", value: report.currentTask }),
      React.createElement(InfoRow, { label: "Blocker", value: report.selectedBlocker }),
      React.createElement(InfoRow, { label: "Vocal Arousal", value: `${Number(report.vocalArousalScore || 0).toFixed(1)} / 10` }),
      
      React.createElement(View, { style: styles.divider }),

      React.createElement(SectionTitle, { number: 2 }, "Session Query"),
      React.createElement(Text, { style: styles.sectionBody }, report.initialAnxietyQuery || 'No direct query captured.'),
      
      React.createElement(View, { style: styles.divider }),

      React.createElement(SectionTitle, { number: 3 }, "Identified Worry Blocks"),
      worries.length > 0 
        ? worries.map((w, i) => React.createElement(Bullet, { key: i }, `"${w.text}" - weight ${w.weight}/10`))
        : React.createElement(Text, { style: styles.sectionBody }, "None captured for this session."),

      React.createElement(SectionTitle, { number: 4 }, "Task Timeline"),
      timeline.length > 0
        ? timeline.map((q, i) => React.createElement(Bullet, { key: i }, `[${q.completed ? '\u2713' : '\u25CB'}] ${q.action} (~${q.duration_minutes}m)`))
        : React.createElement(Text, { style: styles.sectionBody }, "None captured for this session."),

      React.createElement(View, { style: styles.divider }),

      React.createElement(SectionTitle, { number: 5 }, "AI Clinical Summary"),
      React.createElement(Text, { style: styles.sectionBody }, report.aiStressSummary || 'AI summary unavailable.'),

      report.recoveryProtocol && React.createElement(RecoveryProtocol, { protocol: report.recoveryProtocol }),

      React.createElement(View, { style: styles.divider }),

      React.createElement(SectionTitle, { number: 6 }, "Guardian Contact"),
      React.createElement(InfoRow, { label: "Guardian", value: report.guardian?.name }),
      React.createElement(InfoRow, { label: "Contact", value: report.guardian?.phone || report.guardian?.email }),

      React.createElement(Text, { style: styles.footer },
        "This report is generated by AuraOS to support informed caregiving. Not a medical diagnosis. AuraOS - Neuroscience Powered Support."
      )
    )
  );
};

// ── Export ───────────────────────────────────────────────────────────────────

export const buildClinicalReportPdfBuffer = async report => {
  return await renderToBuffer(React.createElement(ClinicalReportDocument, { report: report }));
};
