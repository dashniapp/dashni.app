import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../theme';

const PRIVACY_POLICY = `Last updated: March 2026
Full policy available at: https://dashni.app/privacy

1. INFORMATION WE COLLECT
We collect information you provide when creating an account including your name, email address, age, gender, location, profile photos and videos.

2. HOW WE USE YOUR INFORMATION
We use your information to provide and improve the Dashni service, match you with other users, send you notifications about matches and messages, and ensure the safety of our community.

3. INFORMATION SHARING
We do not sell your personal data to third parties. Your profile information is visible to other Dashni users. We may share data with service providers who help us operate the app (Supabase for database and storage).

4. DATA RETENTION
You can delete your account at any time from Settings. Upon deletion, your profile and messages will be permanently removed within 30 days.

5. AGE REQUIREMENT
Dashni is strictly for users aged 18 and over. We do not knowingly collect data from anyone under 18. Any account found to belong to a minor will be immediately terminated.

6. YOUR RIGHTS
You have the right to access, correct, or delete your personal data. Contact us at privacy@dashni.app for any data requests.

7. SECURITY
We use industry-standard encryption to protect your data. However no method of transmission over the internet is 100% secure.

8. CONTACT US
For privacy concerns contact: privacy@dashni.app`;

const TERMS = `Last updated: March 2026
Full policy available at: https://dashni.app/privacy

1. ACCEPTANCE OF TERMS
By creating a Dashni account you agree to these Terms of Service. If you do not agree, do not use the app.

2. ELIGIBILITY
You must be at least 18 years old to use Dashni. By registering you confirm you are 18 or older. Providing false age information will result in permanent account termination.

3. YOUR ACCOUNT
You are responsible for maintaining the security of your account. You must provide accurate information. One account per person is allowed.

4. ACCEPTABLE USE
You agree NOT to:
- Post fake, misleading or inappropriate content
- Harass, abuse or harm other users
- Use the app for commercial purposes
- Attempt to access other users accounts
- Post content belonging to minors

5. VIDEO AND PHOTOS
By uploading content you grant Dashni a license to display it within the app. You confirm you own the rights to any content you upload. Inappropriate content will be removed.

6. PAYMENTS
Premium subscriptions are billed through Apple App Store or Google Play. All purchases are final unless required by law.

7. TERMINATION
We reserve the right to terminate accounts that violate these terms at any time without notice.

8. CONTACT
For support contact: support@dashni.app`;

export default function LegalScreen({ route, navigation }) {
  const type = route.params?.type || 'privacy';
  const isPrivacy = type === 'privacy';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, !isPrivacy && styles.tabActive]}
            onPress={() => navigation.setParams({ type: 'terms' })}
          >
            <Text style={[styles.tabText, !isPrivacy && styles.tabTextActive]}>Terms</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isPrivacy && styles.tabActive]}
            onPress={() => navigation.setParams({ type: 'privacy' })}
          >
            <Text style={[styles.tabText, isPrivacy && styles.tabTextActive]}>Privacy</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.content}>{isPrivacy ? PRIVACY_POLICY : TERMS}</Text>

        <TouchableOpacity
          style={styles.fullPolicyBtn}
          onPress={() => Linking.openURL(isPrivacy ? 'https://dashni.app/privacy' : 'https://dashni.app/terms')}
          activeOpacity={0.7}
        >
          <Feather name="external-link" size={14} color={colors.accent} />
          <Text style={styles.fullPolicyText}>View full {isPrivacy ? 'Privacy Policy' : 'Terms of Service'} online</Text>
        </TouchableOpacity>

        <View style={styles.contactCard}>
          <Feather name="mail" size={16} color={colors.accent} />
          <Text style={styles.contactText}>
            Questions? Email us at{' '}
            <Text style={styles.contactEmail}>support@dashni.app</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  scroll: { padding: 20, gap: 20, paddingBottom: 60 },
  tabs: { flexDirection: 'row', backgroundColor: colors.bgSurface, borderRadius: radius.md, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  content: { color: colors.textSecondary, fontSize: 14, lineHeight: 24 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  fullPolicyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12 },
  fullPolicyText: { color: colors.accent, fontSize: 14, textDecorationLine: 'underline' },
  contactText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  contactEmail: { color: colors.accent, fontWeight: '600' },
});
