import { useState } from 'react';
import { Text, View } from 'react-native';

import { restaurantDetailsError, type RestaurantDetails } from '@/data/owner-restaurant';
import { CUISINES } from '@/data/restaurants';
import { t } from '@/i18n';

import { ChoiceChips, Field, formStyles, PrimaryButton } from './form-controls';
import { showMessage } from '@/utils/feedback';

type Cuisine = (typeof CUISINES)[number];
const asCuisine = (value: string): Cuisine => (CUISINES as readonly string[]).includes(value) ? value as Cuisine : 'Other';

/** Shared by onboarding ("Create restaurant") and the dashboard ("Save restaurant information"). */
export function RestaurantDetailsForm({ initial, onSubmit, submitLabel }: { initial: RestaurantDetails; onSubmit: (details: RestaurantDetails) => Promise<void>; submitLabel: string }) {
  const [values, setValues] = useState({
    ...initial,
    cuisine: asCuisine(initial.cuisine),
    facilities: initial.facilities.join(', '),
    pricePerPerson: initial.pricePerPerson ? String(initial.pricePerPerson) : '',
    seatsPerSlot: String(initial.seatsPerSlot || 40),
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof values>(key: K) => (value: (typeof values)[K]) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const details: RestaurantDetails = {
      ...values,
      facilities: values.facilities.split(',').map((item) => item.trim()).filter(Boolean),
      pricePerPerson: values.pricePerPerson.trim() ? Number(values.pricePerPerson.replace(/[,\s]/g, '')) : 0,
      seatsPerSlot: Number(values.seatsPerSlot.replace(/[,\s]/g, '')),
    };
    const problem = restaurantDetailsError(details);
    if (problem) return showMessage(t('ownerForm.checkTitle'), problem);
    setSaving(true);
    try {
      await onSubmit(details);
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Field label={t('ownerForm.name')} onChangeText={set('name')} placeholder="Mama Ntilie Kitchen" value={values.name} />
    <ChoiceChips label={t('ownerForm.cuisine')} onChange={set('cuisine')} options={CUISINES} value={values.cuisine} />
    <Field label={t('ownerForm.area')} onChangeText={set('area')} placeholder="Masaki" value={values.area} />
    <Field label={t('ownerForm.address')} onChangeText={set('address')} placeholder="Haile Selassie Road, Masaki" value={values.address} />
    <Field autoCapitalize="none" keyboardType="url" label={t('ownerForm.mapUrl')} onChangeText={set('mapUrl')} placeholder="https://maps.app.goo.gl/…" value={values.mapUrl} />
    <Field label={t('ownerForm.description')} multiline onChangeText={set('description')} placeholder={t('ownerForm.descriptionPlaceholder')} value={values.description} />
    <Field autoComplete="tel" keyboardType="phone-pad" label={t('restaurant.phone')} onChangeText={set('phone')} placeholder="+255 7…" value={values.phone} />
    <Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" label={t('profile.emailOptional')} onChangeText={set('email')} placeholder="hello@restaurant.co.tz" value={values.email} />
    <Field keyboardType="number-pad" label={t('ownerForm.price')} onChangeText={set('pricePerPerson')} placeholder="35000" value={values.pricePerPerson} />
    <View style={formStyles.row}>
      <Field containerStyle={formStyles.half} label={t('ownerForm.opens')} onChangeText={set('opensAt')} placeholder="08:00" value={values.opensAt} />
      <Field containerStyle={formStyles.half} label={t('ownerForm.closes')} onChangeText={set('closesAt')} placeholder="22:00" value={values.closesAt} />
    </View>
    <Field keyboardType="number-pad" label={t('ownerForm.seats')} onChangeText={set('seatsPerSlot')} placeholder="40" value={values.seatsPerSlot} />
    <Text style={formStyles.helper}>{t('ownerForm.seatsHelp')}</Text>
    <Field label={t('ownerForm.facilities')} onChangeText={set('facilities')} placeholder={t('ownerForm.facilitiesPlaceholder')} value={values.facilities} />
    <PrimaryButton busy={saving} label={submitLabel} onPress={() => void submit()} />
  </>;
}
