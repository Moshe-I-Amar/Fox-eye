import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Colors, Shadows } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AlertBanner from '../../components/ui/AlertBanner';
import useMobilization from '../../hooks/useMobilization';
import { useAuth } from '../../context/AuthContext';

const PHASES = ['ACTIVE', 'TRANSIT', 'PREPARATION', 'DEPLOYMENT'];
const PHASE_LABELS = {
  ACTIVE:      'MOBILIZED',
  TRANSIT:     'IN TRANSIT',
  PREPARATION: 'PREPARATION',
  DEPLOYMENT:  'DEPLOYED',
  STOOD_DOWN:  'STOOD DOWN',
};

const NEXT_STATUS = {
  ACTIVE:      'TRANSIT',
  TRANSIT:     'PREPARATION',
  PREPARATION: 'DEPLOYMENT',
};

const MOBILIZE_ROLES = ['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER', 'TEAM_COMMANDER'];

export default function MobilizeTab() {
  const { user } = useAuth();
  const {
    activeMobilization,
    loading,
    sending,
    error,
    advanceStatus,
    standDown,
    clearError,
  } = useMobilization({ realtimeEnabled: true });

  const [confirmStandDown, setConfirmStandDown] = useState(false);

  const canMobilize = MOBILIZE_ROLES.includes(user?.operationalRole);
  const mob         = activeMobilization;
  const currentIdx  = mob ? PHASES.indexOf(mob.status) : -1;
  const nextStatus  = mob ? NEXT_STATUS[mob.status] : null;

  const handleAdvance = useCallback(async () => {
    if (!mob || !nextStatus) return;
    try { await advanceStatus(mob._id, nextStatus); } catch { /* error shown via hook */ }
  }, [mob, nextStatus, advanceStatus]);

  const handleStandDown = useCallback(async () => {
    if (!mob) return;
    if (!confirmStandDown) { setConfirmStandDown(true); return; }
    setConfirmStandDown(false);
    try { await standDown(mob._id); } catch { /* error shown via hook */ }
  }, [mob, confirmStandDown, standDown]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.header}>C2 MOBILIZATION</Text>

      {error && (
        <AlertBanner message={error} tone="error" onDismiss={clearError} />
      )}

      {!mob ? (
        /* No active mobilization */
        <View style={styles.idleContainer}>
          <View style={styles.idleIcon}>
            <Text style={styles.idleIconText}>📡</Text>
          </View>
          <Text style={styles.idleTitle}>NO ACTIVE MOBILIZATION</Text>
          <Text style={styles.idleBody}>
            All units are standing by.
            {'\n'}Use the desktop dashboard to trigger a mobilization order.
          </Text>
          {!canMobilize && (
            <Text style={styles.roleNote}>
              Mobilization requires Team Commander rank or above.
            </Text>
          )}
        </View>
      ) : (
        /* Active mobilization card */
        <Card>
          {/* Phase progress dots */}
          <View style={styles.phases}>
            {PHASES.map((phase, idx) => (
              <View key={phase} style={styles.phaseItem}>
                <View style={[
                  styles.phaseDot,
                  idx <= currentIdx && styles.phaseDotActive,
                  idx === currentIdx && styles.phaseDotCurrent,
                ]} />
                <Text style={[
                  styles.phaseLabel,
                  idx === currentIdx && styles.phaseLabelActive,
                ]}>
                  {PHASE_LABELS[phase]}
                </Text>
              </View>
            ))}
          </View>

          {/* Status badge */}
          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {PHASE_LABELS[mob.status] || mob.status}
              </Text>
            </View>
          </View>

          {/* Incident description */}
          {mob.incidentDescription && (
            <Text style={styles.incident}>{mob.incidentDescription}</Text>
          )}

          {/* Rally point */}
          {mob.rallyPointName && (
            <Text style={styles.rallyPoint}>Rally: {mob.rallyPointName}</Text>
          )}

          {/* Phase advance button */}
          {nextStatus && (
            <TouchableOpacity
              style={[styles.advanceBtn, sending && styles.btnDisabled]}
              onPress={handleAdvance}
              disabled={sending}
              activeOpacity={0.8}
            >
              <Text style={styles.advanceBtnText}>
                {sending ? 'UPDATING…' : `ADVANCE → ${PHASE_LABELS[nextStatus]}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Stand down */}
          {mob.status !== 'STOOD_DOWN' && (
            <TouchableOpacity
              style={[styles.standDownBtn, confirmStandDown && styles.standDownBtnConfirm]}
              onPress={handleStandDown}
              disabled={sending}
              activeOpacity={0.8}
            >
              <Text style={styles.standDownText}>
                {confirmStandDown ? 'CONFIRM STAND DOWN' : 'STAND DOWN'}
              </Text>
            </TouchableOpacity>
          )}

          {confirmStandDown && (
            <TouchableOpacity onPress={() => setConfirmStandDown(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.jet },
  content: { padding: 16, paddingBottom: 100 },
  centered: {
    flex: 1, backgroundColor: Colors.jet,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    color: Colors.gold, fontSize: 11,
    fontWeight: '700', letterSpacing: 3,
    marginBottom: 16,
  },
  idleContainer: { alignItems: 'center', paddingTop: 40 },
  idleIcon:      { marginBottom: 16 },
  idleIconText:  { fontSize: 48 },
  idleTitle: {
    color: Colors.gold, fontSize: 13,
    fontWeight: '700', letterSpacing: 3,
    marginBottom: 12,
  },
  idleBody: {
    color: Colors.gray400, textAlign: 'center',
    fontSize: 13, lineHeight: 20,
  },
  roleNote: {
    marginTop: 16, color: Colors.amber400,
    fontSize: 12, textAlign: 'center',
  },
  phases: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  phaseItem:  { alignItems: 'center', flex: 1 },
  phaseDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.slateDark,
    marginBottom: 4,
  },
  phaseDotActive:  { backgroundColor: `${Colors.gold}66` },
  phaseDotCurrent: { backgroundColor: Colors.gold, ...Shadows.goldGlow },
  phaseLabel:      { fontSize: 8, color: Colors.gray400, letterSpacing: 0.5, textAlign: 'center' },
  phaseLabelActive: { color: Colors.gold },
  statusRow:   { alignItems: 'flex-start', marginBottom: 10 },
  statusBadge: {
    backgroundColor: `${Colors.red400}22`,
    borderWidth: 1, borderColor: Colors.red400,
    borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3,
  },
  statusBadgeText: { color: Colors.red400, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  incident:  { color: Colors.white, fontSize: 13, marginBottom: 6, lineHeight: 18 },
  rallyPoint: { color: Colors.gray400, fontSize: 12, marginBottom: 14 },
  advanceBtn: {
    backgroundColor: Colors.gold, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
    marginTop: 8, ...Shadows.goldGlow,
  },
  advanceBtnText: { color: Colors.jet, fontWeight: '700', fontSize: 12, letterSpacing: 1.5 },
  btnDisabled:    { opacity: 0.5 },
  standDownBtn: {
    marginTop: 10, borderWidth: 1, borderColor: Colors.red400,
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  standDownBtnConfirm: { backgroundColor: Colors.red400 },
  standDownText: { color: Colors.red400, fontWeight: '700', fontSize: 12, letterSpacing: 1.5 },
  cancelBtn:  { marginTop: 8, alignItems: 'center', padding: 8 },
  cancelText: { color: Colors.gray400, fontSize: 13 },
});
