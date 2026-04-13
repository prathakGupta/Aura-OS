// src/services/reportPdf.js — v2.0
// Now includes Therapeutic Activity Suite section with game telemetry analysis.
// Game sessions feed a predictive health analysis section for therapists.

import PDFDocument from 'pdfkit';

const clamp = (v, max = 300) => String(v || '').trim().slice(0, max);

const bullets = (items, fallback = 'None captured for this session.') =>
  items.length ? items.map((item) => `• ${item}`).join('\n') : fallback;

const writeSection = (doc, title, body, opts = {}) => {
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#0f172a').text(title, { align: 'left' });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor('#1f2937').text(body, { align: 'left', lineGap: 2, ...opts });
  doc.moveDown(0.8);
};

const writeSectionDivider = (doc) => {
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  doc.moveDown(0.5);
};

const riskColor = (level) => {
  if (level === 'acute-distress') return '#dc2626';
  if (level === 'pre-burnout') return '#ea580c';
  return '#16a34a';
};

const arousalLabel = (level) => ({
  high: 'HIGH — Elevated neurological arousal detected',
  moderate: 'MODERATE — Normal stress processing range',
  low: 'LOW — Calm state, possible disengagement',
}[level] || 'UNKNOWN');

export const buildClinicalReportPdfBuffer = async (report) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 44, bottom: 44, left: 48, right: 48 },
    info: {
      Title: `AuraOS Clinical Report — ${report.userId || 'User'}`,
      Author: 'AuraOS Clinical Intelligence Layer',
      Subject: 'Mental Health Telemetry Report',
    },
  });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  // ── Header band ───────────────────────────────────────────────────────────
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;

  doc.rect(margin - 4, 28, pageW - (margin - 4) * 2, 52).fill('#0f172a');

  doc.fillColor('#e2e8f0').font('Helvetica-Bold').fontSize(14)
    .text('AuraOS Clinical Triage Report', margin, 40, { align: 'left' });

  const generatedAt = new Date(report.meta?.generatedAt || report.createdAt || Date.now())
    .toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
    .text(`Generated: ${generatedAt}  |  Risk: ${(report.riskLevel || 'watch').toUpperCase()}  |  Report ID: ${report._id || 'N/A'}`,
      margin, 58, { align: 'left' });

  // Risk badge
  const riskX = pageW - margin - 80;
  doc.rect(riskX, 36, 76, 22).fill(riskColor(report.riskLevel));
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    .text((report.riskLevel || 'WATCH').toUpperCase(), riskX + 4, 43, { width: 68, align: 'center' });

  doc.fillColor('#111827');
  doc.x = margin;
  doc.y = 100;
  doc.moveDown(0.5);

  // ── Section 1: Session Context ────────────────────────────────────────────
  writeSection(doc, '1. Session Context', [
    `Patient ID:        ${clamp(report.userId, 80) || 'N/A'}`,
    `Current Task:      ${clamp(report.currentTask, 200) || 'Not specified'}`,
    `Blocker Selected:  ${clamp(report.selectedBlocker, 120) || 'Not specified'}`,
    `Vocal Arousal:     ${Number(report.vocalArousalScore || 0).toFixed(1)} / 10`,
    `Risk Classification: ${clamp(report.riskLevel, 40) || 'watch'}`,
  ].join('\n'));

  writeSectionDivider(doc);

  // ── Section 2: Initial Anxiety Query ─────────────────────────────────────
  writeSection(doc, '2. Initial Anxiety Query / Self-Report',
    clamp(report.initialAnxietyQuery, 700) || 'No direct query captured in this report window.');

  writeSectionDivider(doc);

  // ── Section 3: Shattered Worry Blocks ────────────────────────────────────
  const worries = (report.shatteredWorryBlocks || []).slice(0, 10)
    .map((w, i) => `${i + 1}. "${clamp(w.text, 80)}" — weight ${w.weight || '?'}/10 [${w.status || 'active'}]`);

  writeSection(doc, '3. Identified Worry Blocks', bullets(worries));
  writeSectionDivider(doc);

  // ── Section 4: Shattered Task Timeline ───────────────────────────────────
  const timeline = (report.timelineMicroquests || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, 10)
    .map((q, i) => {
      const d = Number(q.duration_minutes) || 2;
      const done = q.completed ? '✓' : '○';
      return `${i + 1}. [${done}] ${clamp(q.action, 120)} (~${d}m)`;
    });

  writeSection(doc, '4. Task Timeline (User-Arranged Order)', bullets(timeline));
  writeSectionDivider(doc);

  // ── Section 5: Therapeutic Activity Suite ────────────────────────────────
  const sessions = report.gameSessions || report.meta?.gameSessions || [];

  if (sessions.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#0f172a')
      .text('5. Therapeutic Activity Suite', { align: 'left' });
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(10).fillColor('#374151')
      .text(`The patient engaged with ${sessions.length} therapeutic game session(s) during this AuraOS visit, ` +
        `totalling ${sessions.reduce((s, g) => s + (g.durationSeconds || 0), 0)} seconds of active intervention. ` +
        'Interaction patterns provide the following predictive health indicators:', { lineGap: 2 });
    doc.moveDown(0.5);

    sessions.forEach((session, idx) => {
      const eff = session.predictedEffects || {};
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1e40af')
        .text(`  ${idx + 1}. ${session.gameName || session.gameId}`, { align: 'left' });
      doc.moveDown(0.1);

      const lines = [
        `     Duration: ${session.durationSeconds}s  |  Score: ${session.score}  |  Interactions: ${session.interactions}`,
        `     Reaction Time (avg): ${session.avgReactionMs}ms  |  Accuracy: ${session.accuracy}%`,
        `     Arousal Level: ${arousalLabel(eff.arousalLevel)}`,
        `     Stress Reduction (est.): ${eff.stressReduction || 0}/10  |  Dopamine Activation: ${eff.dopamineActivation || 0}/10  |  Focus Score: ${eff.focusScore || 0}/10`,
      ];

      doc.font('Helvetica').fontSize(9.5).fillColor('#374151')
        .text(lines.join('\n'), { lineGap: 1.5 });

      if (eff.clinicalNote) {
        doc.moveDown(0.15);
        doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
          .text(`     Clinical Note: ${clamp(eff.clinicalNote, 300)}`, { lineGap: 1.5 });
      }
      doc.moveDown(0.45);
    });

    // Aggregate summary
    const totalStressRed = sessions.reduce((s, g) => s + (g.predictedEffects?.stressReduction || 0), 0);
    const totalDopamine  = sessions.reduce((s, g) => s + (g.predictedEffects?.dopamineActivation || 0), 0);
    const avgFocus       = sessions.length
      ? (sessions.reduce((s, g) => s + (g.predictedEffects?.focusScore || 0), 0) / sessions.length).toFixed(1)
      : 0;

    const highArousal = sessions.filter((s) => s.predictedEffects?.arousalLevel === 'high').length;
    const aggNote = highArousal >= 2
      ? `${highArousal} of ${sessions.length} sessions showed HIGH arousal patterns, suggesting significant emotional activation requiring therapeutic follow-up.`
      : `Activity patterns indicate moderate to normal emotional regulation capacity. Continued engagement with therapeutic activities is recommended.`;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
      .text('  Aggregate Therapeutic Activity Analysis:', { align: 'left' });
    doc.font('Helvetica').fontSize(9.5).fillColor('#374151')
      .text([
        `  • Total Predicted Stress Reduction: ${totalStressRed} cumulative units across ${sessions.length} sessions`,
        `  • Total Dopamine Activation Events: ${totalDopamine} cumulative units`,
        `  • Average Focus Score: ${avgFocus}/10`,
        `  • ${aggNote}`,
      ].join('\n'), { lineGap: 2 });
    doc.moveDown(0.8);
    writeSectionDivider(doc);
  } else {
    writeSection(doc, '5. Therapeutic Activity Suite',
      'No therapeutic game sessions were logged during this session. Consider encouraging the patient to engage with the ' +
      'Bug Zapper, Focus Dot, or Cloud Bloom activities in a follow-up session to gather baseline interaction data.');
    writeSectionDivider(doc);
  }

  // ── Section 6: AI Stress Summary ─────────────────────────────────────────
  const sectionNum = 6;
  writeSection(doc, `${sectionNum}. AI Clinical Stress Summary`,
    clamp(report.aiStressSummary, 1400) || 'AI summary unavailable for this session.');
  writeSectionDivider(doc);

  // ── Section 7: Guardian Contact ───────────────────────────────────────────
  const gLine    = report.guardian?.name
    ? `${clamp(report.guardian.name, 80)} | ${clamp(report.guardian.relation, 60) || 'relation N/A'}`
    : 'Guardian details not on file';
  const cLine    = report.guardian?.phone || report.guardian?.email
    ? [report.guardian.phone, report.guardian.email].filter(Boolean).map(s => clamp(s, 120)).join('  |  ')
    : 'No contact details';

  writeSection(doc, `${sectionNum + 1}. Guardian Contact`, `${gLine}\n${cLine}`);

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
    .text(
      'This report is generated by AuraOS to support informed caregiving during stress-related events. ' +
      'It is not a medical diagnosis. All game-derived metrics are predictive estimates based on interaction ' +
      'patterns and should be interpreted in conjunction with clinical observation. AuraOS — Vihaan DTU 9.0.',
      { align: 'left', lineGap: 2 }
    );

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
};