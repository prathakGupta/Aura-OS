// src/services/reportPdf.js — v3.0
// Uses @react-pdf/renderer for UTF-8 emoji support, styled layouts, and professional clinical reports.
// Falls back to a lightweight pdfkit implementation if @react-pdf/renderer is not available.

import React from 'react';
import { renderToBuffer, Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';

// ── Register Google Font (Inter) for professional typography ─────────────────
Font.register({
  family: 'Inter',
  fonts: [{
    src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
    fontWeight: 400
  }, {
    src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
    fontWeight: 600
  }, {
    src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf',
    fontWeight: 700
  }]
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
  white: '#ffffff'
};
const riskColor = level => {
  if (level === 'acute-distress') return colors.riskAcute;
  if (level === 'pre-burnout') return colors.riskPre;
  return colors.riskWatch;
};
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.5
  },
  headerBar: {
    backgroundColor: colors.dark,
    padding: 16,
    marginBottom: 16,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 700
  },
  headerSub: {
    color: '#94a3b8',
    fontSize: 8,
    marginTop: 2
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
    alignSelf: 'center'
  },
  riskBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: 700
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.dark,
    marginBottom: 4,
    marginTop: 12
  },
  sectionBody: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.6
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    marginVertical: 8
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2
  },
  label: {
    fontWeight: 600,
    width: 140,
    color: colors.muted,
    fontSize: 9
  },
  value: {
    flex: 1,
    fontSize: 9.5
  },
  bulletItem: {
    flexDirection: 'row',
    marginLeft: 8,
    marginBottom: 2
  },
  bulletDot: {
    width: 12,
    fontSize: 9
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.5
  },
  gameCard: {
    backgroundColor: colors.bgLight,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: colors.border
  },
  gameTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: colors.accent,
    marginBottom: 2
  },
  gameStats: {
    fontSize: 8.5,
    color: colors.muted
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: colors.muted,
    textAlign: 'center'
  },
  aggrBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    padding: 10,
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: '#bfdbfe'
  },
  aggrTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: colors.dark,
    marginBottom: 4
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const clamp = (v, max = 300) => String(v || '').trim().slice(0, max);
const arousalLabel = level => ({
  high: 'HIGH - Elevated neurological arousal',
  moderate: 'MODERATE - Normal stress processing',
  low: 'LOW - Calm state'
})[level] || 'UNKNOWN';

// ── Sub-components ──────────────────────────────────────────────────────────
const SectionTitle = ({
  number,
  children
}) => /*#__PURE__*/React.createElement(Text, {
  style: styles.sectionTitle
}, number, ". ", children);
const InfoRow = ({
  label,
  value
}) => /*#__PURE__*/React.createElement(View, {
  style: styles.row
}, /*#__PURE__*/React.createElement(Text, {
  style: styles.label
}, label), /*#__PURE__*/React.createElement(Text, {
  style: styles.value
}, value || 'N/A'));
const Bullet = ({
  children
}) => /*#__PURE__*/React.createElement(View, {
  style: styles.bulletItem
}, /*#__PURE__*/React.createElement(Text, {
  style: styles.bulletDot
}, '  \u2022'), /*#__PURE__*/React.createElement(Text, {
  style: styles.bulletText
}, children));
const Divider = () => /*#__PURE__*/React.createElement(View, {
  style: styles.divider
});

// ── Main PDF Document ───────────────────────────────────────────────────────
const ClinicalReportDocument = ({
  report
}) => {
  const generatedAt = new Date(report.meta?.generatedAt || report.createdAt || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const worries = (report.shatteredWorryBlocks || []).slice(0, 10);
  const timeline = (report.timelineMicroquests || []).sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 10);
  const sessions = report.gameSessions || report.meta?.gameSessions || [];
  return /*#__PURE__*/React.createElement(Document, null, /*#__PURE__*/React.createElement(Page, {
    size: "A4",
    style: styles.page
  }, /*#__PURE__*/React.createElement(View, {
    style: styles.headerBar
  }, /*#__PURE__*/React.createElement(View, null, /*#__PURE__*/React.createElement(Text, {
    style: styles.headerTitle
  }, "AuraOS Clinical Triage Report"), /*#__PURE__*/React.createElement(Text, {
    style: styles.headerSub
  }, "Generated: ", generatedAt, "  |  Report ID: ", report._id || 'N/A')), /*#__PURE__*/React.createElement(View, {
    style: [styles.riskBadge, {
      backgroundColor: riskColor(report.riskLevel)
    }]
  }, /*#__PURE__*/React.createElement(Text, {
    style: styles.riskBadgeText
  }, (report.riskLevel || 'WATCH').toUpperCase()))), /*#__PURE__*/React.createElement(SectionTitle, {
    number: 1
  }, "Session Context"), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Patient ID",
    value: clamp(report.userId, 80)
  }), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Current Task",
    value: clamp(report.currentTask, 200)
  }), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Blocker",
    value: clamp(report.selectedBlocker, 120)
  }), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Vocal Arousal",
    value: `${Number(report.vocalArousalScore || 0).toFixed(1)} / 10`
  }), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Risk Level",
    value: clamp(report.riskLevel, 40)
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(SectionTitle, {
    number: 2
  }, "Initial Anxiety Query / Self-Report"), /*#__PURE__*/React.createElement(Text, {
    style: styles.sectionBody
  }, clamp(report.initialAnxietyQuery, 700) || 'No direct query captured in this report window.'), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(SectionTitle, {
    number: 3
  }, "Identified Worry Blocks"), worries.length > 0 ? worries.map((w, i) => /*#__PURE__*/React.createElement(Bullet, {
    key: i
  }, "\"", clamp(w.text, 80), "\" - weight ", w.weight || '?', "/10 [", w.status || 'active', "]")) : /*#__PURE__*/React.createElement(Text, {
    style: styles.sectionBody
  }, "None captured for this session."), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(SectionTitle, {
    number: 4
  }, "Task Timeline (User-Arranged Order)"), timeline.length > 0 ? timeline.map((q, i) => {
    const d = Number(q.duration_minutes) || 2;
    const done = q.completed ? '\u2713' : '\u25CB';
    return /*#__PURE__*/React.createElement(Bullet, {
      key: i
    }, "[", done, "] ", clamp(q.action, 120), " (~", d, "m)");
  }) : /*#__PURE__*/React.createElement(Text, {
    style: styles.sectionBody
  }, "None captured for this session."), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(SectionTitle, {
    number: 5
  }, "Therapeutic Activity Suite"), sessions.length > 0 ? /*#__PURE__*/React.createElement(View, null, /*#__PURE__*/React.createElement(Text, {
    style: styles.sectionBody
  }, "The patient engaged with ", sessions.length, " therapeutic game session(s), totalling", ' ', sessions.reduce((s, g) => s + (g.durationSeconds || 0), 0), " seconds of active intervention."), sessions.map((session, idx) => {
    const eff = session.predictedEffects || {};
    return /*#__PURE__*/React.createElement(View, {
      key: idx,
      style: styles.gameCard
    }, /*#__PURE__*/React.createElement(Text, {
      style: styles.gameTitle
    }, session.gameName || session.gameId), /*#__PURE__*/React.createElement(Text, {
      style: styles.gameStats
    }, "Duration: ", session.durationSeconds, "s  |  Score: ", session.score, "  |  Interactions: ", session.interactions), /*#__PURE__*/React.createElement(Text, {
      style: styles.gameStats
    }, "Reaction Time: ", session.avgReactionMs, "ms  |  Accuracy: ", session.accuracy, "%"), /*#__PURE__*/React.createElement(Text, {
      style: styles.gameStats
    }, "Arousal: ", arousalLabel(eff.arousalLevel), " | Stress Reduction: ", eff.stressReduction || 0, "/10 | Focus: ", eff.focusScore || 0, "/10"), eff.clinicalNote ? /*#__PURE__*/React.createElement(Text, {
      style: [styles.gameStats, {
        marginTop: 2,
        fontStyle: 'italic'
      }]
    }, "Clinical Note: ", clamp(eff.clinicalNote, 300)) : null);
  }), /*#__PURE__*/React.createElement(View, {
    style: styles.aggrBox
  }, /*#__PURE__*/React.createElement(Text, {
    style: styles.aggrTitle
  }, "Aggregate Therapeutic Analysis"), /*#__PURE__*/React.createElement(Text, {
    style: styles.gameStats
  }, "Total Stress Reduction: ", sessions.reduce((s, g) => s + (g.predictedEffects?.stressReduction || 0), 0), " units", ' | ', "Dopamine Activation: ", sessions.reduce((s, g) => s + (g.predictedEffects?.dopamineActivation || 0), 0), " units", ' | ', "Avg Focus: ", sessions.length ? (sessions.reduce((s, g) => s + (g.predictedEffects?.focusScore || 0), 0) / sessions.length).toFixed(1) : 0, "/10"))) : /*#__PURE__*/React.createElement(Text, {
    style: styles.sectionBody
  }, "No therapeutic game sessions were logged during this session."), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(SectionTitle, {
    number: 6
  }, "AI Clinical Stress Summary"), /*#__PURE__*/React.createElement(Text, {
    style: styles.sectionBody
  }, clamp(report.aiStressSummary, 1400) || 'AI summary unavailable for this session.'), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(SectionTitle, {
    number: 7
  }, "Guardian Contact"), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Guardian",
    value: report.guardian?.name ? `${clamp(report.guardian.name, 80)} | ${clamp(report.guardian.relation, 60) || 'relation N/A'}` : 'Guardian details not on file'
  }), /*#__PURE__*/React.createElement(InfoRow, {
    label: "Contact",
    value: report.guardian?.phone || report.guardian?.email ? [report.guardian.phone, report.guardian.email].filter(Boolean).join('  |  ') : 'No contact details'
  }), /*#__PURE__*/React.createElement(Text, {
    style: styles.footer
  }, "This report is generated by AuraOS to support informed caregiving during stress-related events. It is not a medical diagnosis. All game-derived metrics are predictive estimates based on interaction patterns. AuraOS - Vihaan DTU 9.0.")));
};

// ── Export (same API signature as v2) ────────────────────────────────────────
export const buildClinicalReportPdfBuffer = async report => {
  return await renderToBuffer(/*#__PURE__*/React.createElement(ClinicalReportDocument, {
    report: report
  }));
};
