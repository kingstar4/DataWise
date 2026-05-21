import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const save = async () => {
        setError('');

        if (!/^\d{4}$/.test(pin)) {
            setError('Create a 4-digit purchase PIN');
            return;
        }

        if (pin !== confirmPin) {
            setError('PINs do not match');
            return;
        }

        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError('Session expired. Please sign in again.');
            setLoading(false);
            return;
        }

        const { error } = await supabase.functions.invoke('set-purchase-pin', {
            body: { pin },
        });

        setLoading(false);
        if (error) {
            setError(error.message);
            return;
        }

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
                    <Text style={styles.title}>Create your purchase PIN</Text>
                    <Text style={styles.subtitle}>
                        Use this 4-digit PIN whenever you buy data from your wallet.
                        You will enter the delivery phone number only when purchasing.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Create PIN"
                        placeholderTextColor="#4a5568"
                        keyboardType="number-pad"
                        secureTextEntry
                        value={pin}
                        onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Confirm PIN"
                        placeholderTextColor="#4a5568"
                        keyboardType="number-pad"
                        secureTextEntry
                        value={confirmPin}
                        onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
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
                    Your phone number is requested at checkout so you can buy for any line.
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
