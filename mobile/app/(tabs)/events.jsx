import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/theme';
import Card from '../../components/ui/Card';
import useFieldEvents from '../../hooks/useFieldEvents';
import { eventApi } from '../../services/eventApi';

const EVENT_COLORS = {
  INJURED: Colors.red400,
  AMBUSH:  Colors.amber400,
  LINK_UP: Colors.green400,
};

const STATUS_LABELS = {
  ACTIVE:       'ACTIVE',
  ACKNOWLEDGED: 'ACK',
  RESOLVED:     'RESOLVED',
};

function EventCard({ event, onRespond, isPending }) {
  const color = EVENT_COLORS[event.eventType] || Colors.gray400;
  const sender = event.senderId?.name || event.senderId || 'Unknown';

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { borderColor: color }]}>
          <Text style={[styles.typeBadgeText, { color }]}>{event.eventType}</Text>
        </View>
        <Text style={styles.statusText}>{STATUS_LABELS[event.status] || event.status}</Text>
      </View>

      <Text style={styles.sender}>{sender}</Text>
      <Text style={styles.timestamp}>
        {event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}
      </Text>

      {event.status === 'ACTIVE' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: Colors.amber400 }]}
            onPress={() => onRespond(event._id, 'acknowledge')}
            disabled={isPending}
          >
            <Text style={[styles.actionText, { color: Colors.amber400 }]}>ACK</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: Colors.green400 }]}
            onPress={() => onRespond(event._id, 'resolve')}
            disabled={isPending}
          >
            <Text style={[styles.actionText, { color: Colors.green400 }]}>RESOLVE</Text>
          </TouchableOpacity>
        </View>
      )}

      {event.status === 'ACKNOWLEDGED' && (
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: Colors.green400, marginTop: 8 }]}
          onPress={() => onRespond(event._id, 'resolve')}
          disabled={isPending}
        >
          <Text style={[styles.actionText, { color: Colors.green400 }]}>RESOLVE</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

export default function EventsTab() {
  const { events, loading, refetch, updateEvent } = useFieldEvents(30);
  const [respondingIds, setRespondingIds] = useState(new Set());

  const handleRespond = useCallback(async (id, action) => {
    if (respondingIds.has(id)) return;
    setRespondingIds((prev) => new Set(prev).add(id));
    try {
      let updated;
      if (action === 'acknowledge') {
        updated = await eventApi.acknowledgeEvent(id);
      } else {
        updated = await eventApi.resolveEvent(id);
      }
      updateEvent(id, updated.event || updated);
    } catch (err) {
      console.warn('[EventsTab] respond error:', err.message);
    } finally {
      setRespondingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [respondingIds, updateEvent]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.header}>FIELD EVENTS</Text>
      <FlatList
        data={events}
        keyExtractor={(e) => e._id}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onRespond={handleRespond}
            isPending={respondingIds.has(item._id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={Colors.gold}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No field events</Text>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.jet,
  },
  header: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    padding: 16,
    paddingBottom: 8,
  },
  list: {
    padding: 12,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 10,
    color: Colors.gray400,
    letterSpacing: 1,
  },
  sender: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    color: Colors.gray400,
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.jet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
