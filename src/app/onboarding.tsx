import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const formatPhone = (raw: string) => {
        const digits = raw.replace(/\D/g, '');
        if (digits.startsWith('0') && digits.length === 11)
            return `+234${digits.slice(1)}`;
        if (digits.startsWith('234')) return `+${digits}`;
        return raw;
    };

    const save = async () => {
        setError('');
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) {
            setError('Enter a valid Nigerian phone number');
            return;
        }

        setLoading(true);
        const formatted = formatPhone(phone);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('Session expired. Please sign in again.'); setLoading(false); return; }

        // upsert instead of update — creates the row if it doesn't exist
        const { error } = await supabase
            .from('profiles')
            .upsert(
                { user_id: user.id, phone_number: formatted },
                { onConflict: 'user_id' }
            );

        setLoading(false);
        if (error) { setError(error.message); return; }
        onComplete();
    };

    return (
        <LinearGradient colors={['#0B1020', '#0d1535']} style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inner}
            >
                <View style={styles.header}>
                    <Text style={styles.logo}>DataWise</Text>
                    <Text style={styles.step}>One last thing</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.title}>Your data number</Text>
                    <Text style={styles.subtitle}>
                        Which phone number should we deliver purchased data bundles to?
                        This is saved to your account and can be changed anytime.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="08012345678"
                        placeholderTextColor="#4a5568"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                        maxLength={14}
                    />

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={save}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.buttonText}>Save & Continue</Text>
                        }
                    </TouchableOpacity>
                </View>

                <Text style={styles.note}>
                    💡 Data bundles are delivered instantly to this number after purchase
                </Text>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 40 },
    logo: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
    step: { fontSize: 14, color: '#6366F1', marginTop: 6 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24, lineHeight: 22 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    button: {
        backgroundColor: '#6366F1',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    error: { color: '#EC4899', fontSize: 13, marginBottom: 12 },
    note: { textAlign: 'center', color: '#4a5568', fontSize: 12, marginTop: 32 },
});