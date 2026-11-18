import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { addMenuItem, deleteMenuItem, menuItemError, updateMenuItem, type MenuItemInput } from '@/data/owner-restaurant';
import { pickPhoto, removeRestaurantPhoto, uploadRestaurantPhoto } from '@/data/restaurant-photos';
import { formatTsh, isMenuItemAvailable, type MenuItem, type Restaurant } from '@/data/restaurants';
import { confirmAction, errorMessage } from '@/utils/feedback';

import { Field, formStyles, OWNER_COLORS, PrimaryButton, Section, TextButton } from './form-controls';

export function MenuManager({ onMenuChange, restaurant }: { onMenuChange: (menu: MenuItem[]) => void; restaurant: Restaurant }) {
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const replaceItem = (id: string, changes: Partial<MenuItem>) => onMenuChange(restaurant.menu.map((item) => item.id === id ? { ...item, ...changes } : item));

  const setInStock = async (item: MenuItem, inStock: boolean) => {
    replaceItem(item.id, { inStock });
    try {
      await updateMenuItem(item.id, { inStock });
    } catch (error) {
      replaceItem(item.id, { inStock: item.inStock });
      Alert.alert('Could not update availability', errorMessage(error));
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
      Alert.alert('Could not upload photo', errorMessage(error));
    } finally {
      setBusyItem(null);
    }
  };

  const remove = (item: MenuItem) => confirmAction('Remove food?', `${item.name} will be removed from the customer menu.`, 'Remove', () => {
    setBusyItem(item.id);
    deleteMenuItem(item.id)
      .then(() => { onMenuChange(restaurant.menu.filter((food) => food.id !== item.id)); void removeRestaurantPhoto(item.photoUrl); })
      .catch((error: unknown) => Alert.alert('Could not remove food', errorMessage(error)))
      .finally(() => setBusyItem(null));
  });

  return <>
    <Section helper="All foods stay visible to customers. Out-of-stock or out-of-hours foods show an Unavailable badge." title="Food menu">
      {restaurant.menu.length === 0
        ? <View style={styles.empty}><Text style={styles.emptyTitle}>No food on the menu yet</Text><Text style={formStyles.helper}>Add your first dish below.</Text></View>
        : restaurant.menu.map((item) => {
          const available = isMenuItemAvailable(item, restaurant);
          const busy = busyItem === item.id;
          return <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Pressable accessibilityLabel={`${item.photoUrl ? 'Change' : 'Add'} photo for ${item.name}`} disabled={busyItem !== null} onPress={() => void changePhoto(item)}>
                {item.photoUrl
                  ? <Image contentFit="cover" source={item.photoUrl} style={styles.photo} transition={150} />
                  : <View style={[styles.photo, styles.photoPlaceholder]}><Text style={styles.photoIcon}>📷</Text></View>}
                <Text style={styles.photoAction}>{busy ? 'Uploading…' : item.photoUrl ? 'Change photo' : 'Add photo'}</Text>
              </Pressable>
              <View style={styles.copy}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.ingredients}>{item.description}</Text>
                <Text style={styles.price}>{formatTsh(item.price)}</Text>
                <Text style={styles.serving}>Served {item.availableFrom}–{item.availableUntil}</Text>
              </View>
            </View>
            <View style={styles.availabilityRow}>
              <View>
                <Text style={[styles.status, !available && styles.unavailable]}>{available ? 'AVAILABLE NOW' : 'UNAVAILABLE'}</Text>
                <Text style={styles.stockLabel}>In stock</Text>
              </View>
              <Switch accessibilityLabel={`${item.name} in stock`} onValueChange={(inStock) => void setInStock(item, inStock)} thumbColor="#FFF" trackColor={{ false: '#B8B1AA', true: OWNER_COLORS.accent }} value={item.inStock} />
            </View>
            <TextButton destructive disabled={busyItem !== null} label="Remove food" onPress={() => remove(item)} />
          </View>;
        })}
    </Section>
    <AddFoodForm onAdded={(item) => onMenuChange([...restaurant.menu, item])} restaurant={restaurant} />
  </>;
}

function AddFoodForm({ onAdded, restaurant }: { onAdded: (item: MenuItem) => void; restaurant: Restaurant }) {
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
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
    const input: MenuItemInput = { name, description: ingredients, price: Number(price.replace(/[,\s]/g, '')), availableFrom, availableUntil, inStock: true, photoUrl: null };
    const problem = menuItemError(input);
    if (problem) return Alert.alert('Check the food details', problem);
    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (photo) uploaded = await uploadRestaurantPhoto(restaurant.id, photo, 'menu');
      onAdded(await addMenuItem(restaurant.id, { ...input, photoUrl: uploaded }));
      setName(''); setIngredients(''); setPrice(''); setPhoto(null);
    } catch (error) {
      void removeRestaurantPhoto(uploaded);
      Alert.alert('Could not add food', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return <Section title="Add food">
    <Field label="FOOD NAME" onChangeText={setName} placeholder="Chicken biryani" value={name} />
    <Field label="INGREDIENTS" multiline onChangeText={setIngredients} placeholder="Rice, chicken, spices…" value={ingredients} />
    <Field keyboardType="number-pad" label="PRICE (TSH)" onChangeText={setPrice} placeholder="25000" value={price} />
    <View style={formStyles.row}>
      <Field containerStyle={formStyles.half} label="SERVED FROM" onChangeText={setAvailableFrom} placeholder="08:00" value={availableFrom} />
      <Field containerStyle={formStyles.half} label="SERVED UNTIL" onChangeText={setAvailableUntil} placeholder="22:00" value={availableUntil} />
    </View>
    <Text style={styles.label}>PHOTO (OPTIONAL)</Text>
    <View style={styles.newPhotoRow}>
      {photo ? <Image contentFit="cover" source={photo.uri} style={styles.photo} /> : <View style={[styles.photo, styles.photoPlaceholder]}><Text style={styles.photoIcon}>📷</Text></View>}
      <View style={styles.newPhotoActions}>
        <TextButton disabled={saving} label={photo ? 'Choose a different photo' : 'Choose photo'} onPress={() => void choosePhoto()} />
        {photo && <TextButton destructive disabled={saving} label="Remove photo" onPress={() => setPhoto(null)} />}
      </View>
    </View>
    <PrimaryButton busy={saving} busyLabel={photo ? 'Uploading…' : 'Saving…'} label="Add food to menu" onPress={() => void add()} />
  </Section>;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', padding: 22, marginTop: 14, borderRadius: 15, backgroundColor: OWNER_COLORS.cream },
  emptyTitle: { color: OWNER_COLORS.ink, fontSize: 15, fontWeight: '900' },
  card: { marginTop: 13, padding: 14, borderWidth: 1, borderColor: OWNER_COLORS.line, borderRadius: 16, backgroundColor: '#FFF' },
  cardTop: { flexDirection: 'row', gap: 13 },
  photo: { width: 96, height: 72, borderRadius: 12, backgroundColor: '#E9DFD3' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoIcon: { fontSize: 24 },
  photoAction: { color: OWNER_COLORS.accent, fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  copy: { flex: 1 },
  name: { color: OWNER_COLORS.ink, fontSize: 15, fontWeight: '900' },
  ingredients: { color: OWNER_COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  price: { color: OWNER_COLORS.accent, fontSize: 12, fontWeight: '900', marginTop: 6 },
  serving: { color: OWNER_COLORS.muted, fontSize: 10, marginTop: 4 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  status: { alignSelf: 'flex-start', color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900' },
  unavailable: { color: '#8E2F1A', backgroundColor: '#F5D8D1' },
  stockLabel: { color: OWNER_COLORS.muted, fontSize: 9, marginTop: 5 },
  label: { color: OWNER_COLORS.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 15, marginBottom: 8 },
  newPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  newPhotoActions: { gap: 6 },
});
