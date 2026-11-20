import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME, PRIVACY_POLICY_UPDATED, SUPPORT_EMAIL } from '@/constants/app-info';
import { goBackOrReplace } from '@/utils/navigation';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What we collect',
    body: [
      'Your name, phone number and, if you give it, your email address, so restaurants can confirm your order or table.',
      'Your delivery address for delivery orders, and the dishes, totals and times of your orders and bookings.',
      'Account details if you register: your full name, phone number, email address and a password (stored only as a secure hash by our hosting provider), and whether you are a customer or a restaurant owner.',
      'A notification token for your phone if you allow notifications, so we can tell you when your order or table is ready.',
      'For restaurant owners: restaurant details, menus, the photos and menu PDF you upload, and the restaurant’s map location if you add it.',
      'Ratings and comments you choose to leave about restaurants after a completed order or booking.',
    ],
  },
  {
    title: 'What we do not collect',
    body: [
      'If you turn on location, the app uses your phone’s position only on your phone, to show how far restaurants are. It is never sent to Kwetu or stored, and you can turn it off at any time in your phone settings.',
      'We do not sell your data or use it for advertising.',
      'We do not store card numbers. The mobile money number you type when paying is not saved.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'The restaurant you order from or book with sees your name, phone number, email, delivery address and order.',
      'If you review a restaurant, your star rating, comment and first name are shown publicly on its page. Deleting your account removes your name from your reviews.',
      `${APP_NAME} administrators can see restaurant listings to review them, and can look up orders and bookings (including the customer’s name and phone number) to help customers and restaurants with problems.`,
      'Data is stored with our hosting provider (Supabase) and notifications are delivered through Expo. They process it only to run the app.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'Orders and bookings are kept so restaurants have a record of what they served.',
      'Details you save on your phone stay there until you delete them or uninstall the app.',
    ],
  },
  {
    title: 'Deleting your data',
    body: [
      'Signed-in users can delete their account at any time from Settings → Profile → Delete account. This removes the account, removes your name, phone number and address from past orders and bookings, hides any restaurant you own, and clears the data saved on your phone.',
      'If you use the app without an account, your details are stored only on your phone and are removed when you uninstall the app.',
    ],
  },
];

export default function PrivacyScreen() {
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>{APP_NAME.toUpperCase()}</Text>
    <Text style={styles.title}>Privacy policy</Text>
    <Text style={styles.updated}>Last updated {PRIVACY_POLICY_UPDATED}</Text>
    <Text style={styles.intro}>{APP_NAME} helps you find restaurants, order food and book tables. This page explains what information the app uses and how you stay in control of it.</Text>
    {SECTIONS.map((section) => <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.body.map((line) => <Text key={line} style={styles.paragraph}>{line}</Text>)}
    </View>)}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Contact</Text>
      <Text selectable style={styles.paragraph}>{SUPPORT_EMAIL ? `Questions or deletion requests: ${SUPPORT_EMAIL}` : `Questions or deletion requests: contact ${APP_NAME} through the app store listing.`}</Text>
    </View>
  </ScrollView></SafeAreaView>;
}

const styles = themedStyles(({ bg, fg }) => ({
  safeArea: { flex: 1, backgroundColor: bg('#FFF8ED') },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  back: { color: fg(ORANGE), fontSize: 14, fontWeight: '800', marginBottom: 25 },
  eyebrow: { color: fg(ORANGE), fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: fg('#171612'), fontSize: 34, fontWeight: '900', marginTop: 6 },
  updated: { color: fg('#918A81'), fontSize: 12, marginTop: 4 },
  intro: { color: fg('#4F4A43'), fontSize: 15, lineHeight: 23, marginTop: 16 },
  section: { marginTop: 24 },
  sectionTitle: { color: fg('#171612'), fontSize: 18, fontWeight: '900', marginBottom: 6 },
  paragraph: { color: fg('#4F4A43'), fontSize: 14, lineHeight: 21, marginTop: 6 },
}));
