import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

const STEPS = [
  { icon: 'camera', title: 'Take a selfie', sub: 'Hold your phone at eye level in good lighting' },
  { icon: 'check-circle', title: 'Under review', sub: 'Our team will verify your photo within 24 hours' },
  { icon: 'award', title: 'Verified!', sub: 'Your profile now shows a verified badge' },
];

export default function VerificationScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [selfieUri, setSelfieUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled) {
      setSelfieUri(result.assets[0].uri);
    }
  };

  const submitVerification = async () => {
    if (!selfieUri) {
      Alert.alert('Take a selfie first', 'Please take a selfie to verify your identity.');
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const response = await fetch(selfieUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      await supabase.storage
        .from('avatars')
        .upload(`${user.id}/verification.jpg`, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      await supabase.from('profiles')
        .update({ verification_status: 'pending' })
        .eq('id', user.id);
      setStep(1);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setUploading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get verified</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        {/* Steps indicator */}
        <View style={styles.stepsRow}>
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                {i < step ? (
                  <Feather name="check" size={12} color="#fff" />
                ) : (
                  <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
                )}
              </View>
              {i < STEPS.length - 1 && (
                <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {step === 0 && (
          <>
            {/* Badge preview */}
            <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.badgePreview}>
              <View style={styles.badgeOverlay} />
              <Ionicons name="checkmark-circle" size={48} color="#fff" />
              <Text style={styles.badgeTitle}>Verified Profile</Text>
              <Text style={styles.badgeSub}>Trusted by Dashni</Text>
            </LinearGradient>

            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsTitle}>Why get verified?</Text>
              <View style={styles.benefit}><Feather name="shield" size={15} color="#3b82f6" /><Text style={styles.benefitText}>Blue verified badge on your profile</Text></View>
              <View style={styles.benefit}><Feather name="trending-up" size={15} color="#3b82f6" /><Text style={styles.benefitText}>Shown more often in discovery</Text></View>
              <View style={styles.benefit}><Feather name="heart" size={15} color="#3b82f6" /><Text style={styles.benefitText}>Users trust verified profiles more</Text></View>
              <View style={styles.benefit}><Feather name="check-circle" size={15} color="#3b82f6" /><Text style={styles.benefitText}>Completely free to verify</Text></View>
            </View>

            {selfieUri ? (
              <View style={styles.selfiePreview}>
                <Image source={{ uri: selfieUri }} style={styles.selfieImg} />
                <TouchableOpacity style={styles.retakeBtn} onPress={takeSelfie}>
                  <Feather name="refresh-cw" size={14} color={colors.accent} />
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.selfieBtn} onPress={takeSelfie} activeOpacity={0.85}>
                <Feather name="camera" size={20} color="#fff" />
                <Text style={styles.selfieBtnText}>Take verification selfie</Text>
              </TouchableOpacity>
            )}

            {selfieUri && (
              <TouchableOpacity
                style={[styles.submitBtn, uploading && { opacity: 0.7 }]}
                onPress={submitVerification}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for verification</Text>}
              </TouchableOpacity>
            )}
          </>
        )}

        {step === 1 && (
          <View style={styles.pendingWrap}>
            <View style={styles.pendingIcon}>
              <Feather name="clock" size={36} color="#ff9800" />
            </View>
            <Text style={styles.pendingTitle}>Under review</Text>
            <Text style={styles.pendingSub}>We're reviewing your selfie. This usually takes less than 24 hours. We'll notify you when it's done!</Text>
            <View style={styles.pendingCard}>
              <View style={styles.benefit}><Feather name="mail" size={15} color={colors.accent} /><Text style={styles.benefitText}>You'll get an email when verified</Text></View>
              <View style={styles.benefit}><Feather name="bell" size={15} color={colors.accent} /><Text style={styles.benefitText}>And a notification in the app</Text></View>
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.submitBtnText}>Back to profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  content: { flex: 1, padding: 16, gap: 16 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  stepNum: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  stepNumActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, maxWidth: 60 },
  stepLineActive: { backgroundColor: '#3b82f6' },
  badgePreview: { borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 8, overflow: 'hidden' },
  badgeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  badgeTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  badgeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  benefitsCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  benefitsTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { color: colors.textPrimary, fontSize: 14 },
  selfiePreview: { alignItems: 'center', gap: 10 },
  selfieImg: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#3b82f6' },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  retakeBtnText: { color: colors.accent, fontSize: 13 },
  selfieBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#3b82f6', borderRadius: radius.full, paddingVertical: 15 },
  selfieBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pendingWrap: { flex: 1, alignItems: 'center', gap: 16, paddingTop: 20 },
  pendingIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,152,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  pendingSub: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  pendingCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, width: '100%' },
});
