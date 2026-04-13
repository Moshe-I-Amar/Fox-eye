import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Animated, Pressable, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Colors, Shadows, TAB_BAR_HEIGHT } from '../constants/theme';
import { eventApi } from '../services/eventApi';
import useOfflineQueue from '../hooks/useOfflineQueue';

const PANIC_TYPES = [
  { type: 'LINK_UP', label: 'LINK UP',  color: Colors.green400, icon: '⚡' },
  { type: 'AMBUSH',  label: 'AMBUSH',   color: Colors.amber400, icon: '⚠' },
  { type: 'INJURED', label: 'INJURED',  color: Colors.red400,   icon: '🆘' },
];

const AUTO_COLLAPSE_MS = 5000;
const GPS_TIMEOUT_MS   = 8000;

export default function PanicFAB() {
  const [armed,        setArmed]        = useState(false);
  const [pending,      setPending]      = useState(null);   // { type }
  const [gpsCoords,    setGpsCoords]    = useState(null);   // [lng, lat] or null
  const [gpsReady,     setGpsReady]     = useState(false);
  const [sending,      setSending]      = useState(false);
  const [sentBanner,   setSentBanner]   = useState(null);   // 'success' | 'queued'
  const { enqueue, flush } = useOfflineQueue();

  // Staggered animation values for 3 sub-buttons
  const subAnims = useRef(PANIC_TYPES.map(() => new Animated.Value(0))).current;
  const collapseTimer = useRef(null);

  const collapse = useCallback(() => {
    setArmed(false);
    Animated.parallel(
      subAnims.map((a) => Animated.timing(a, { toValue: 0, duration: 150, useNativeDriver: true }))
    ).start();
    clearTimeout(collapseTimer.current);
  }, [subAnims]);

  const expand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setArmed(true);
    Animated.stagger(
      50,
      subAnims.map((a) => Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 100 }))
    ).start();
    // Auto-collapse after 5s
    clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(collapse, AUTO_COLLAPSE_MS);
  }, [subAnims, collapse]);

  const handleTriggerPress = useCallback(() => {
    if (armed) { collapse(); } else { expand(); }
  }, [armed, collapse, expand]);

  const handlePanicPress = useCallback(async (type) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    collapse();
    setPending({ type });
    setGpsCoords(null);
    setGpsReady(false);

    // Race GPS against timeout
    const gpsPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }).then((pos) => {
      const coords = [pos.coords.longitude, pos.coords.latitude];
      setGpsCoords(coords);
      setGpsReady(true);
      return coords;
    }).catch(() => {
      setGpsReady(true); // timed out or denied
      return null;
    });

    // Give GPS GPS_TIMEOUT_MS before modal shows "no GPS"
    setTimeout(() => setGpsReady(true), GPS_TIMEOUT_MS);

    // Keep GPS promise alive for use during confirm
    pending?.gpsPromise;
    setPending({ type, gpsPromise });
  }, [collapse]);

  const handleConfirm = useCallback(async (sendAnyway = false) => {
    if (!pending) return;
    setSending(true);

    let coords = gpsCoords;
    if (!coords && !sendAnyway) return; // wait for GPS if not sending anyway

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const payload = {
      eventType:   pending.type,
      ...(coords && {
        coordinates: coords, // [lng, lat] — GeoJSON order
      }),
    };

    try {
      await eventApi.createEvent(payload);
      setSentBanner('success');
    } catch (err) {
      // Network error or server down — queue offline
      if (!err.response || err.response.status >= 500) {
        await enqueue(payload);
        setSentBanner('queued');
      } else {
        setSentBanner('error');
      }
    } finally {
      setSending(false);
      setPending(null);
      setGpsCoords(null);
      setGpsReady(false);
      setTimeout(() => setSentBanner(null), 4000);
    }
  }, [pending, gpsCoords, enqueue]);

  const handleCancel = useCallback(() => {
    setPending(null);
    setGpsCoords(null);
    setGpsReady(false);
  }, []);

  // Format coords for display
  const coordDisplay = gpsCoords
    ? `${gpsCoords[1].toFixed(5)}°N  ${gpsCoords[0].toFixed(5)}°E`
    : null;

  const pendingColor = pending ? (PANIC_TYPES.find((p) => p.type === pending.type)?.color || Colors.gold) : Colors.gold;

  return (
    <>
      {/* Sub-buttons (expand upward from trigger) */}
      {PANIC_TYPES.map((p, idx) => {
        const translateY = subAnims[idx].interpolate({
          inputRange:  [0, 1],
          outputRange: [0, -(80 * (idx + 1))],
        });
        return (
          <Animated.View
            key={p.type}
            style={[
              styles.subBtn,
              { transform: [{ translateY }], opacity: subAnims[idx] },
            ]}
          >
            <TouchableOpacity
              style={[styles.subBtnInner, { borderColor: p.color }]}
              onPress={() => handlePanicPress(p.type)}
              activeOpacity={0.8}
            >
              <Text style={styles.subBtnIcon}>{p.icon}</Text>
              <Text style={[styles.subBtnLabel, { color: p.color }]}>{p.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main trigger FAB */}
      <TouchableOpacity
        style={[styles.fab, armed && styles.fabArmed]}
        onPress={handleTriggerPress}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>{armed ? '✕' : '⊕'}</Text>
      </TouchableOpacity>

      {/* Sent feedback banner */}
      {sentBanner && (
        <View style={[
          styles.sentBanner,
          { backgroundColor: sentBanner === 'success' ? '#14532d' : '#78350f' },
        ]}>
          <Text style={styles.sentBannerText}>
            {sentBanner === 'success' ? '✓ Signal sent' : '⏳ Queued — will send when connected'}
          </Text>
        </View>
      )}

      {/* Confirm modal */}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCancel}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: pendingColor }]}>
              <Text style={[styles.modalTitle, { color: pendingColor }]}>
                {PANIC_TYPES.find((p) => p.type === pending?.type)?.icon}{' '}
                {pending?.type}
              </Text>
            </View>

            {/* GPS status */}
            {!gpsReady ? (
              <View style={styles.gpsRow}>
                <ActivityIndicator size="small" color={Colors.gold} />
                <Text style={styles.gpsText}>Acquiring GPS…</Text>
              </View>
            ) : coordDisplay ? (
              <Text style={styles.gpsCoords}>{coordDisplay}</Text>
            ) : (
              <Text style={styles.gpsWarn}>⚠ No GPS fix — location will not be included</Text>
            )}

            {/* Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={handleCancel} disabled={sending}>
                <Text style={styles.cancelModalText}>CANCEL</Text>
              </TouchableOpacity>

              {gpsReady && coordDisplay && (
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: pendingColor }, sending && styles.btnDisabled]}
                  onPress={() => handleConfirm(false)}
                  disabled={sending}
                >
                  <Text style={styles.confirmText}>{sending ? '…' : 'SEND'}</Text>
                </TouchableOpacity>
              )}

              {gpsReady && !coordDisplay && (
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: Colors.gray600 }, sending && styles.btnDisabled]}
                  onPress={() => handleConfirm(true)}
                  disabled={sending}
                >
                  <Text style={styles.confirmText}>{sending ? '…' : 'SEND ANYWAY'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const FAB_SIZE   = 56;
const SUB_SIZE   = 48;
const FAB_BOTTOM = TAB_BAR_HEIGHT + 16;
const FAB_RIGHT  = 20;

const styles = StyleSheet.create({
  fab: {
    position:        'absolute',
    bottom:          FAB_BOTTOM,
    right:           FAB_RIGHT,
    width:           FAB_SIZE,
    height:          FAB_SIZE,
    borderRadius:    FAB_SIZE / 2,
    backgroundColor: Colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          200,
    ...Shadows.goldGlow,
  },
  fabArmed: {
    backgroundColor: Colors.slateDark,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  fabIcon: {
    fontSize: 22,
    color:    Colors.jet,
    fontWeight: '700',
  },
  subBtn: {
    position:  'absolute',
    bottom:    FAB_BOTTOM,
    right:     FAB_RIGHT,
    zIndex:    199,
  },
  subBtnInner: {
    width:          SUB_SIZE + 40,
    height:         SUB_SIZE,
    borderRadius:   SUB_SIZE / 2,
    backgroundColor: Colors.charcoal,
    borderWidth:    1,
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 12,
    gap:            8,
    ...Shadows.subtle,
  },
  subBtnIcon:  { fontSize: 16 },
  subBtnLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  sentBanner: {
    position:  'absolute',
    bottom:    FAB_BOTTOM + FAB_SIZE + 12,
    right:     FAB_RIGHT,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex:    200,
  },
  sentBannerText: { color: Colors.white, fontSize: 12, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  modalBox: {
    width:           '100%',
    backgroundColor: Colors.charcoal,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     `${Colors.gold}40`,
    padding:         20,
    ...Shadows.goldGlow,
  },
  modalHeader: {
    borderBottomWidth: 1,
    paddingBottom:     12,
    marginBottom:      16,
  },
  modalTitle: {
    fontSize:   20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  16,
  },
  gpsText: {
    color: Colors.gray400,
    fontSize: 13,
  },
  gpsCoords: {
    color:        Colors.green400,
    fontSize:     13,
    fontWeight:   '600',
    marginBottom: 16,
    fontVariant:  ['tabular-nums'],
  },
  gpsWarn: {
    color:        Colors.amber400,
    fontSize:     12,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap:           10,
  },
  cancelModalBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.gray600,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelModalText: {
    color: Colors.gray400,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  btnDisabled: { opacity: 0.5 },
});
