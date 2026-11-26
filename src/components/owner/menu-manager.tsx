import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { categoryHint, categoryIcon, categoryLabel, MENU_CATEGORIES, type MenuCategory } from '@/data/menu-categories';
import { addMenuItem, deleteMenuItem, menuItemError, updateMenuItem, type MenuItemInput } from '@/data/owner-restaurant';
import { pickPhoto, removeRestaurantPhoto, uploadRestaurantPhoto } from '@/data/restaurant-photos';
import { formatTsh, isMenuItemAvailable, type MenuItem, type Restaurant } from '@/data/restaurants';
import { t } from '@/i18n';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { ChoiceChips, Field, formStyles, OWNER_COLORS, PrimaryButton, Section, TextButton } from './form-controls';
import { themedStyles } from '@/theme/theme';

export function MenuManager({ onMenuChange, restaurant }: { onMenuChange: (menu: MenuItem[]) => void; restaurant: Restaurant }) {
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const replaceItem = (id: string, changes: Partial<MenuItem>) => onMenuChange(restaurant.menu.map((item) => item.id === id ? { ...item, ...changes } : item));

  const setInStock = async (item: MenuItem, inStock: boolean) => {
    replaceItem(item.id, { inStock });
    try {
      await updateMenuItem(item.id, { inStock });
    } catch (error) {
      replaceItem(item.id, { inStock: item.inStock });
      showMessage(t('menu.stockFailed'), errorMessage(error));
    }
  };

  const changePhoto = async (item: MenuItem) => {
    const asset = await pickPhoto([4, 3]);
    if (!asset) return;
    setBusyItem(item.id);
    let uploaded: string | null = null;
    try {
      uploaded = await uploadRestaurantPhoto(restaurant.id, asset, 'menu');
      await updateMenuItem(item.id, { photoUrl: uploaded });
      replaceItem(item.id, { photoUrl: uploaded });
      void removeRestaurantPhoto(item.photoUrl);
    } catch (error) {
      void removeRestaurantPhoto(uploaded);
      showMessage(t('photos.uploadFailed'), errorMessage(error));
    } finally {
      setBusyItem(null);
    }
  };

  const remove = (item: MenuItem) => confirmAction(t('menu.removeTitle'), t('menu.removeBody', { name: item.name }), t('menu.remove'), () => {
    setBusyItem(item.id);
    deleteMenuItem(item.id)
      .then(() => { onMenuChange(restaurant.menu.filter((food) => food.id !== item.id)); void removeRestaurantPhoto(item.photoUrl); })
      .catch((error: unknown) => showMessage(t('menu.removeFailed'), errorMessage(error)))
      .finally(() => setBusyItem(null));
  });

  return <>
    <AddFoodForm onAdded={(item) => onMenuChange([...restaurant.menu, item])} restaurant={restaurant} />
    <Section helper={t('menu.helper')} title={t('menu.title', { count: restaurant.menu.length })}>
      {restaurant.menu.length === 0
        ? <View style={styles.empty}><Text style={styles.emptyTitle}>{t('menu.empty')}</Text><Text style={formStyles.helper}>{t('menu.emptyHint')}</Text></View>
        : restaurant.menu.map((item) => {
          const available = isMenuItemAvailable(item, restaurant);
          const busy = busyItem === item.id;
          if (editingId === item.id) {
            return <View key={item.id} style={styles.card}>
              <EditFoodForm item={item} onCancel={() => setEditingId(null)} onSaved={(changes) => { replaceItem(item.id, changes); setEditingId(null); }} />
            </View>;
          }
          return <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Pressable accessibilityLabel={t(item.photoUrl ? 'menu.changePhotoFor' : 'menu.addPhotoFor', { name: item.name })} disabled={busyItem !== null} onPress={() => void changePhoto(item)}>
                {item.photoUrl
                  ? <Image contentFit="cover" source={item.photoUrl} style={styles.photo} transition={150} />
                  : <View style={[styles.photo, styles.photoPlaceholder]}><Text style={styles.photoIcon}>📷</Text></View>}
                <Text style={styles.photoAction}>{t(busy ? 'common.uploading' : item.photoUrl ? 'menu.changePhoto' : 'menu.addPhoto')}</Text>
              </Pressable>
              <View style={styles.copy}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.categoryTag}>{categoryIcon(item.category)} {categoryLabel(item.category)}</Text>
                <Text style={styles.ingredients}>{item.description}</Text>
                <Text style={styles.price}>{formatTsh(item.price)}</Text>
                <Text style={styles.serving}>{t('restaurant.served', { from: item.availableFrom, until: item.availableUntil })}</Text>
              </View>
            </View>
            <View style={styles.availabilityRow}>
              <View>
                <Text style={[styles.status, !available && styles.unavailable]}>{t(available ? 'menu.availableNow' : 'restaurant.unavailable')}</Text>
                <Text style={styles.stockLabel}>{t('menu.inStock')}</Text>
              </View>
              <Switch accessibilityLabel={t('menu.inStockA11y', { name: item.name })} onValueChange={(inStock) => void setInStock(item, inStock)} thumbColor="#FFF" trackColor={{ false: '#B8B1AA', true: OWNER_COLORS.accent }} value={item.inStock} />
            </View>
            <View style={styles.cardActions}>
              <TextButton disabled={busyItem !== null || editingId !== null} label={t('menu.edit')} onPress={() => setEditingId(item.id)} />
              <TextButton destructive disabled={busyItem !== null} label={t('menu.removeFood')} onPress={() => remove(item)} />
            </View>
          </View>;
        })}
    </Section>
  </>;
}

type EditableFields = Pick<MenuItem, 'name' | 'description' | 'category' | 'price' | 'availableFrom' | 'availableUntil'>;

/** The category buttons, with a short hint for the chosen one (e.g. "Sambusa, mandazi, bhajia"). */
function CategoryPicker({ onChange, value }: { onChange: (category: MenuCategory) => void; value: MenuCategory | null }) {
  const hint = value ? categoryHint(value) : '';
  return <>
    <ChoiceChips label={t('menu.category')} labelOf={(category) => `${categoryIcon(category)} ${categoryLabel(category)}`} onChange={onChange} options={MENU_CATEGORIES} value={value} />
    {hint ? <Text style={formStyles.helper}>{hint}</Text> : null}
  </>;
}

function EditFoodForm({ item, onCancel, onSaved }: { item: MenuItem; onCancel: () => void; onSaved: (changes: EditableFields) => void }) {
  const [name, setName] = useState(item.name);
  const [ingredients, setIngredients] = useState(item.description);
  const [category, setCategory] = useState<MenuCategory>(item.category);
  const [price, setPrice] = useState(String(item.price));
  const [availableFrom, setAvailableFrom] = useState(item.availableFrom);
  const [availableUntil, setAvailableUntil] = useState(item.availableUntil);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const changes: EditableFields = { name: name.trim(), description: ingredients.trim(), category, price: Number(price), availableFrom, availableUntil };
    const problem = menuItemError({ ...item, ...changes });
    if (problem) return showMessage(t('menu.checkTitle'), problem);
    setSaving(true);
    try {
      await updateMenuItem(item.id, changes);
      onSaved(changes);
    } catch (error) {
      showMessage(t('menu.saveFailed'), errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Text style={styles.editTitle}>{t('menu.editTitle', { name: item.name })}</Text>
    <Field label={t('menu.foodName')} onChangeText={setName} value={name} />
    <PriceField onChange={setPrice} value={price} />
    <CategoryPicker onChange={setCategory} value={category} />
    <Field label={t('menu.ingredients')} multiline onChangeText={setIngredients} value={ingredients} />
    <View style={formStyles.row}>
      <Field containerStyle={formStyles.half} label={t('menu.servedFrom')} onChangeText={setAvailableFrom} placeholder="08:00" value={availableFrom} />
      <Field containerStyle={formStyles.half} label={t('menu.servedUntil')} onChangeText={setAvailableUntil} placeholder="22:00" value={availableUntil} />
    </View>
    <PrimaryButton busy={saving} label={t('menu.saveChanges')} onPress={() => void save()} />
    <View style={styles.cancelRow}><TextButton disabled={saving} label={t('common.cancel')} onPress={onCancel} /></View>
  </>;
}

/** Keeps only digits, so "8,000" or "TSh 8000" both become "8000". */
const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** The price field, with the amount written out underneath ("TSh 8,000") so typos are easy to spot. */
function PriceField({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  return <>
    <Field keyboardType="number-pad" label={t('menu.price')} onChangeText={(text) => onChange(digitsOnly(text))} placeholder="8000" value={value} />
    {value ? <Text style={styles.pricePreview}>{formatTsh(Number(value))}</Text> : null}
  </>;
}

/**
 * Adding a dish needs only a name, a price and a type. The photo comes first because it is the quickest
 * part on a phone; the description and serving times are optional (times default to opening hours).
 */
function AddFoodForm({ onAdded, restaurant }: { onAdded: (item: MenuItem) => void; restaurant: Restaurant }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Kept after adding a dish, since owners often add several dishes of the same category in a row.
  const [category, setCategory] = useState<MenuCategory | null>(null);
  const [price, setPrice] = useState('');
  const [availableFrom, setAvailableFrom] = useState(restaurant.opensAt);
  const [availableUntil, setAvailableUntil] = useState(restaurant.closesAt);
  const [changingTimes, setChangingTimes] = useState(false);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastAdded, setLastAdded] = useState('');

  const choosePhoto = async () => {
    const asset = await pickPhoto([4, 3]);
    if (asset) setPhoto(asset);
  };

  const add = async () => {
    if (!name.trim()) return showMessage(t('menu.checkTitle'), t('ownerError.food'));
    if (!price) return showMessage(t('menu.checkTitle'), t('ownerError.foodPrice'));
    if (!category) return showMessage(t('menu.checkTitle'), t('ownerError.category'));
    const input: MenuItemInput = { name, description, category, price: Number(price), availableFrom, availableUntil, inStock: true, photoUrl: null };
    const problem = menuItemError(input);
    if (problem) return showMessage(t('menu.checkTitle'), problem);
    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (photo) uploaded = await uploadRestaurantPhoto(restaurant.id, photo, 'menu');
      onAdded(await addMenuItem(restaurant.id, { ...input, photoUrl: uploaded }));
      setLastAdded(t('menu.added', { name: name.trim(), price: formatTsh(Number(price)) }));
      setName(''); setDescription(''); setPrice(''); setPhoto(null);
    } catch (error) {
      void removeRestaurantPhoto(uploaded);
      showMessage(t('menu.addFailed'), errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return <Section helper={t('menu.addHelper')} title={t('menu.addTitle')}>
    <Pressable accessibilityLabel={t(photo ? 'menu.chooseDifferent' : 'menu.choosePhoto')} accessibilityRole="button" disabled={saving} onPress={() => void choosePhoto()} style={styles.newPhoto}>
      {photo
        ? <Image contentFit="cover" source={photo.uri} style={styles.newPhotoImage} />
        : <View style={styles.newPhotoEmpty}><Text style={styles.newPhotoIcon}>📷</Text><Text style={styles.newPhotoText}>{t('menu.tapToAddPhoto')}</Text><Text style={styles.newPhotoHint}>{t('menu.photoOptional')}</Text></View>}
    </Pressable>
    {photo && <View style={styles.newPhotoActions}>
      <TextButton disabled={saving} label={t('menu.chooseDifferent')} onPress={() => void choosePhoto()} />
      <TextButton destructive disabled={saving} label={t('menu.removePhoto')} onPress={() => setPhoto(null)} />
    </View>}
    <Field label={t('menu.foodName')} onChangeText={setName} placeholder={t('menu.namePlaceholder')} value={name} />
    <PriceField onChange={setPrice} value={price} />
    <CategoryPicker onChange={setCategory} value={category} />
    <Field label={t('menu.ingredients')} multiline onChangeText={setDescription} placeholder={t('menu.ingredientsPlaceholder')} value={description} />
    {changingTimes
      ? <View style={formStyles.row}>
        <Field containerStyle={formStyles.half} label={t('menu.servedFrom')} onChangeText={setAvailableFrom} placeholder="08:00" value={availableFrom} />
        <Field containerStyle={formStyles.half} label={t('menu.servedUntil')} onChangeText={setAvailableUntil} placeholder="22:00" value={availableUntil} />
      </View>
      : <View style={styles.timesRow}>
        <Text style={styles.timesText}>{t('menu.servedSummary', { from: availableFrom, until: availableUntil })}</Text>
        <TextButton disabled={saving} label={t('menu.changeTimes')} onPress={() => setChangingTimes(true)} />
      </View>}
    <PrimaryButton busy={saving} busyLabel={t(photo ? 'common.uploading' : 'common.saving')} label={t('menu.addButton')} onPress={() => void add()} />
    {lastAdded ? <Text style={styles.added}>{lastAdded}</Text> : null}
  </Section>;
}

const styles = themedStyles(({ bg, fg, line }) => ({
  empty: { alignItems: 'center', padding: 22, marginTop: 14, borderRadius: 15, backgroundColor: bg(OWNER_COLORS.cream) },
  emptyTitle: { color: fg(OWNER_COLORS.ink), fontSize: 15, fontWeight: '900' },
  card: { marginTop: 13, padding: 14, borderWidth: 1, borderColor: line(OWNER_COLORS.line), borderRadius: 16, backgroundColor: bg('#FFF') },
  cardTop: { flexDirection: 'row', gap: 13 },
  photo: { width: 96, height: 72, borderRadius: 12, backgroundColor: bg('#E9DFD3') },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoIcon: { fontSize: 24 },
  photoAction: { color: fg(OWNER_COLORS.accent), fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  copy: { flex: 1 },
  name: { color: fg(OWNER_COLORS.ink), fontSize: 15, fontWeight: '900' },
  categoryTag: { color: fg(OWNER_COLORS.accent), fontSize: 10, fontWeight: '800', marginTop: 3 },
  ingredients: { color: fg(OWNER_COLORS.muted), fontSize: 11, lineHeight: 16, marginTop: 3 },
  price: { color: fg(OWNER_COLORS.accent), fontSize: 12, fontWeight: '900', marginTop: 6 },
  serving: { color: fg(OWNER_COLORS.muted), fontSize: 10, marginTop: 4 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  status: { alignSelf: 'flex-start', color: fg('#28734D'), backgroundColor: bg('#E8F5ED'), borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900' },
  unavailable: { color: fg('#8E2F1A'), backgroundColor: bg('#F5D8D1') },
  stockLabel: { color: fg(OWNER_COLORS.muted), fontSize: 9, marginTop: 5 },
  newPhoto: { marginTop: 14 },
  newPhotoImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: bg('#E9DFD3') },
  newPhotoEmpty: { minHeight: 132, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: line(OWNER_COLORS.accent), backgroundColor: bg('#FFF') },
  newPhotoIcon: { fontSize: 32 },
  newPhotoText: { color: fg(OWNER_COLORS.accent), fontSize: 15, fontWeight: '900' },
  newPhotoHint: { color: fg(OWNER_COLORS.muted), fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  newPhotoActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  pricePreview: { color: fg(OWNER_COLORS.accent), fontSize: 13, fontWeight: '900', marginTop: 6 },
  timesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  timesText: { flex: 1, color: fg(OWNER_COLORS.muted), fontSize: 12, lineHeight: 17 },
  added: { color: fg('#28734D'), fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editTitle: { color: fg(OWNER_COLORS.ink), fontSize: 15, fontWeight: '900' },
  cancelRow: { alignItems: 'center', marginTop: 10 },
}));
