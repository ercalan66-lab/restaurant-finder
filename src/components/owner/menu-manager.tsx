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
    <Section helper={t('menu.helper')} title={t('menu.title')}>
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
    <AddFoodForm onAdded={(item) => onMenuChange([...restaurant.menu, item])} restaurant={restaurant} />
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
    const changes: EditableFields = { name: name.trim(), description: ingredients.trim(), category, price: Number(price.replace(/[,\s]/g, '')), availableFrom, availableUntil };
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
    <Field label={t('menu.ingredients')} multiline onChangeText={setIngredients} value={ingredients} />
    <CategoryPicker onChange={setCategory} value={category} />
    <Field keyboardType="number-pad" label={t('menu.price')} onChangeText={setPrice} value={price} />
    <View style={formStyles.row}>
      <Field containerStyle={formStyles.half} label={t('menu.servedFrom')} onChangeText={setAvailableFrom} placeholder="08:00" value={availableFrom} />
      <Field containerStyle={formStyles.half} label={t('menu.servedUntil')} onChangeText={setAvailableUntil} placeholder="22:00" value={availableUntil} />
    </View>
    <PrimaryButton busy={saving} label={t('menu.saveChanges')} onPress={() => void save()} />
    <View style={styles.cancelRow}><TextButton disabled={saving} label={t('common.cancel')} onPress={onCancel} /></View>
  </>;
}

function AddFoodForm({ onAdded, restaurant }: { onAdded: (item: MenuItem) => void; restaurant: Restaurant }) {
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  // Kept after adding a dish, since owners often add several dishes of the same category in a row.
  const [category, setCategory] = useState<MenuCategory | null>(null);
  const [price, setPrice] = useState('');
  const [availableFrom, setAvailableFrom] = useState(restaurant.opensAt);
  const [availableUntil, setAvailableUntil] = useState(restaurant.closesAt);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const choosePhoto = async () => {
    const asset = await pickPhoto([4, 3]);
    if (asset) setPhoto(asset);
  };

  const add = async () => {
    if (!category) return showMessage(t('menu.checkTitle'), t('ownerError.category'));
    const input: MenuItemInput = { name, description: ingredients, category, price: Number(price.replace(/[,\s]/g, '')), availableFrom, availableUntil, inStock: true, photoUrl: null };
    const problem = menuItemError(input);
    if (problem) return showMessage(t('menu.checkTitle'), problem);
    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (photo) uploaded = await uploadRestaurantPhoto(restaurant.id, photo, 'menu');
      onAdded(await addMenuItem(restaurant.id, { ...input, photoUrl: uploaded }));
      setName(''); setIngredients(''); setPrice(''); setPhoto(null);
    } catch (error) {
      void removeRestaurantPhoto(uploaded);
      showMessage(t('menu.addFailed'), errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return <Section title={t('menu.addTitle')}>
    <Field label={t('menu.foodName')} onChangeText={setName} placeholder={t('menu.namePlaceholder')} value={name} />
    <Field label={t('menu.ingredients')} multiline onChangeText={setIngredients} placeholder={t('menu.ingredientsPlaceholder')} value={ingredients} />
    <CategoryPicker onChange={setCategory} value={category} />
    <Field keyboardType="number-pad" label={t('menu.price')} onChangeText={setPrice} placeholder="25000" value={price} />
    <View style={formStyles.row}>
      <Field containerStyle={formStyles.half} label={t('menu.servedFrom')} onChangeText={setAvailableFrom} placeholder="08:00" value={availableFrom} />
      <Field containerStyle={formStyles.half} label={t('menu.servedUntil')} onChangeText={setAvailableUntil} placeholder="22:00" value={availableUntil} />
    </View>
    <Text style={styles.label}>{t('menu.photoOptional')}</Text>
    <View style={styles.newPhotoRow}>
      {photo ? <Image contentFit="cover" source={photo.uri} style={styles.photo} /> : <View style={[styles.photo, styles.photoPlaceholder]}><Text style={styles.photoIcon}>📷</Text></View>}
      <View style={styles.newPhotoActions}>
        <TextButton disabled={saving} label={t(photo ? 'menu.chooseDifferent' : 'menu.choosePhoto')} onPress={() => void choosePhoto()} />
        {photo && <TextButton destructive disabled={saving} label={t('menu.removePhoto')} onPress={() => setPhoto(null)} />}
      </View>
    </View>
    <PrimaryButton busy={saving} busyLabel={t(photo ? 'common.uploading' : 'common.saving')} label={t('menu.addButton')} onPress={() => void add()} />
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
  label: { color: fg(OWNER_COLORS.muted), fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 15, marginBottom: 8 },
  newPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  newPhotoActions: { gap: 6 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editTitle: { color: fg(OWNER_COLORS.ink), fontSize: 15, fontWeight: '900' },
  cancelRow: { alignItems: 'center', marginTop: 10 },
}));
