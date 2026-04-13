import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Colors, Shadows } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import AlertBanner from '../../components/ui/AlertBanner';

export default function LoginScreen() {
  const { login }           = useAuth();
  const [email, setEmail]   = useState('');
  const [pass,  setPass]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleLogin = async () => {
    if (!email.trim() || !pass) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), pass);
      // Navigation handled by RootGuard in _layout.jsx
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Login failed. Check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / brand */}
        <View style={styles.brand}>
          <Text style={styles.logoText}>FOX-EYE</Text>
          <Text style={styles.tagline}>Field Operations Console</Text>
        </View>

        {error && (
          <AlertBanner
            message={error}
            tone="error"
            onDismiss={() => setError(null)}
          />
        )}

        {/* Email */}
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholderTextColor={Colors.gray600}
          placeholder="operator@unit.mil"
        />

        {/* Password */}
        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={pass}
          onChangeText={setPass}
          secureTextEntry
          autoComplete="password"
          placeholderTextColor={Colors.gray600}
          placeholder="••••••••"
        />

        {/* Sign in */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>{loading ? 'SIGNING IN…' : 'SIGN IN'}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Access is invite-only. Contact your unit administrator.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.jet,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.gold,
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 12,
    color: Colors.gray400,
    letterSpacing: 3,
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gold,
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.charcoal,
    borderWidth: 1,
    borderColor: `${Colors.gold}33`,
    borderRadius: 8,
    color: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  btn: {
    marginTop: 28,
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadows.goldGlow,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: Colors.jet,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 2,
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    color: Colors.gray400,
    fontSize: 12,
  },
});
