import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME, PRIVACY_POLICY_UPDATED, SUPPORT_EMAIL } from '@/constants/app-info';
import { currentLanguage, t, type Language } from '@/i18n';
import { goBackOrReplace } from '@/utils/navigation';
import { themedStyles } from '@/theme/theme';

const ORANGE = '#ED6417';

type Policy = {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string[] }[];
  contactTitle: string;
  contact: string;
};

// The policy is long legal text, so each language keeps its full version here rather than in the
// message dictionaries. Both versions must say the same thing: change them together.
const POLICY: Record<Language, Policy> = {
  en: {
    title: 'Privacy policy',
    updated: `Last updated ${PRIVACY_POLICY_UPDATED}`,
    intro: `${APP_NAME} helps you find restaurants, order food and book tables. This page explains what information the app uses and how you stay in control of it.`,
    sections: [
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
    ],
    contactTitle: 'Contact',
    contact: SUPPORT_EMAIL ? `Questions or deletion requests: ${SUPPORT_EMAIL}` : `Questions or deletion requests: contact ${APP_NAME} through the app store listing.`,
  },
  sw: {
    title: 'Sera ya faragha',
    updated: `Ilisasishwa mwisho ${PRIVACY_POLICY_UPDATED}`,
    intro: `${APP_NAME} inakusaidia kupata migahawa, kuagiza chakula na kuhifadhi meza. Ukurasa huu unaeleza taarifa ambazo programu inatumia na jinsi unavyoendelea kuzidhibiti.`,
    sections: [
      {
        title: 'Tunachokusanya',
        body: [
          'Jina lako, namba yako ya simu na, ukiitoa, barua pepe yako, ili migahawa iweze kuthibitisha oda au meza yako.',
          'Anwani yako ya kuletewa kwa oda za kuletewa, pamoja na vyakula, jumla na saa za oda na uhifadhi wako.',
          'Taarifa za akaunti ukijisajili: jina lako kamili, namba ya simu, barua pepe na nenosiri (linalohifadhiwa na mtoa huduma wetu wa uhifadhi kwa njia salama iliyosimbwa tu), na kama wewe ni mteja au mmiliki wa mgahawa.',
          'Alama ya taarifa (notification token) ya simu yako ukiruhusu taarifa, ili tukujulishe oda au meza yako ikiwa tayari.',
          'Kwa wamiliki wa migahawa: maelezo ya mgahawa, menyu, picha na PDF ya menyu unazopakia, na eneo la mgahawa kwenye ramani ukiliongeza.',
          'Ukadiriaji na maoni unayochagua kuacha kuhusu migahawa baada ya oda au uhifadhi kukamilika.',
        ],
      },
      {
        title: 'Tusichokusanya',
        body: [
          'Ukiwasha eneo, programu inatumia mahali simu yako ilipo kwenye simu yako tu, kuonyesha umbali wa migahawa. Halitumwi kwa Kwetu wala kuhifadhiwa, na unaweza kulizima wakati wowote kwenye mipangilio ya simu yako.',
          'Hatuuzi taarifa zako wala kuzitumia kwa matangazo.',
          'Hatuhifadhi namba za kadi. Namba ya pesa ya simu unayoandika unapolipa haihifadhiwi.',
        ],
      },
      {
        title: 'Nani anaweza kuziona',
        body: [
          'Mgahawa unaoagiza au kuhifadhi meza kwake unaona jina lako, namba ya simu, barua pepe, anwani ya kuletewa na oda yako.',
          'Ukitoa maoni kuhusu mgahawa, ukadiriaji wako wa nyota, maoni na jina lako la kwanza vinaonekana hadharani kwenye ukurasa wake. Ukifuta akaunti yako, jina lako linaondolewa kwenye maoni yako.',
          `Wasimamizi wa ${APP_NAME} wanaweza kuona matangazo ya migahawa ili kuyakagua, na wanaweza kutafuta oda na uhifadhi (pamoja na jina na namba ya simu ya mteja) ili kusaidia wateja na migahawa wanapopata matatizo.`,
          'Taarifa zinahifadhiwa na mtoa huduma wetu wa uhifadhi (Supabase) na taarifa za simu zinatumwa kupitia Expo. Wanazishughulikia kwa ajili ya kuendesha programu tu.',
        ],
      },
      {
        title: 'Tunazihifadhi kwa muda gani',
        body: [
          'Oda na uhifadhi wa meza huhifadhiwa ili migahawa iwe na kumbukumbu ya walichohudumia.',
          'Maelezo unayohifadhi kwenye simu yako yanabaki hapo hadi uyafute au uondoe programu.',
        ],
      },
      {
        title: 'Kufuta taarifa zako',
        body: [
          'Watumiaji walioingia wanaweza kufuta akaunti yao wakati wowote kupitia Mipangilio → Wasifu → Futa akaunti. Hii inaondoa akaunti, inaondoa jina lako, namba ya simu na anwani kwenye oda na uhifadhi wa zamani, inaficha mgahawa wowote unaoumiliki, na inafuta taarifa zilizohifadhiwa kwenye simu yako.',
          'Ukitumia programu bila akaunti, maelezo yako yanahifadhiwa kwenye simu yako tu na yanaondolewa unapoondoa programu.',
        ],
      },
    ],
    contactTitle: 'Mawasiliano',
    contact: SUPPORT_EMAIL ? `Maswali au maombi ya kufuta taarifa: ${SUPPORT_EMAIL}` : `Maswali au maombi ya kufuta taarifa: wasiliana na ${APP_NAME} kupitia ukurasa wake kwenye duka la programu.`,
  },
};

export default function PrivacyScreen() {
  const policy = POLICY[currentLanguage()];
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>{t('common.back')}</Text></Pressable>
    <Text style={styles.eyebrow}>{APP_NAME.toUpperCase()}</Text>
    <Text style={styles.title}>{policy.title}</Text>
    <Text style={styles.updated}>{policy.updated}</Text>
    <Text style={styles.intro}>{policy.intro}</Text>
    {policy.sections.map((section) => <View key={section.title} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.body.map((line) => <Text key={line} style={styles.paragraph}>{line}</Text>)}
    </View>)}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{policy.contactTitle}</Text>
      <Text selectable style={styles.paragraph}>{policy.contact}</Text>
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
