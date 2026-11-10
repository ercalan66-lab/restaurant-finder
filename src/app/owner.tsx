import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { defaultOwnerRestaurant, getOwnerRestaurant, isMenuItemAvailable, type OwnerMenuItem, type OwnerRestaurant, saveOwnerRestaurant } from '@/data/owner-storage';
import { goBackOrReplace } from '@/utils/navigation';
import { supabase } from '../../lib/supabase';

const ORANGE = '#B93F1D';
const CREAM = '#FFF8EE';

export default function OwnerDashboardScreen() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant>(defaultOwnerRestaurant);
  const [facilities, setFacilities] = useState(defaultOwnerRestaurant.facilities.join(', '));
  const [foodName, setFoodName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [price, setPrice] = useState('');
  const [availableFrom, setAvailableFrom] = useState('08:00');
  const [availableUntil, setAvailableUntil] = useState('22:00');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return router.replace('/auth?role=owner');
      if (data.user.user_metadata?.role !== 'owner') {
        Alert.alert('Owner account required', 'Create or sign in with a restaurant-owner account.');
        return router.replace('/profile');
      }
      return getOwnerRestaurant().then((saved) => {
        setRestaurant(saved);
        setFacilities(saved.facilities.join(', '));
      });
    }).catch(() => Alert.alert('Could not load dashboard', 'Please sign in again.'));
  }, []);

  const persist = async (next: OwnerRestaurant, message: string) => {
    try {
      await saveOwnerRestaurant(next);
      setRestaurant(next);
      Alert.alert('Saved', message);
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    }
  };

  const saveDetails = () => {
    if (!restaurant.name.trim() || !restaurant.address.trim()) {
      return Alert.alert('Missing information', 'Enter the restaurant name and location.');
    }
    const next = {
      ...restaurant,
      name: restaurant.name.trim(),
      address: restaurant.address.trim(),
      mapUrl: restaurant.mapUrl.trim(),
      facilities: facilities.split(',').map((item) => item.trim()).filter(Boolean),
    };
    return persist(next, 'Restaurant information updated.');
  };

  const addFood = () => {
    const numericPrice = Number(price);
    if (!foodName.trim() || !ingredients.trim() || !numericPrice) {
      return Alert.alert('Missing food information', 'Enter the food name, ingredients, and price.');
    }
    const item: OwnerMenuItem = {
      id: `${Date.now()}`,
      name: foodName.trim(),
      ingredients: ingredients.trim(),
      price: numericPrice,
      availableFrom,
      availableUntil,
      inStock: true,
    };
    setFoodName('');
    setIngredients('');
    setPrice('');
    return persist({ ...restaurant, menu: [...restaurant.menu, item] }, 'Food added to the menu.');
  };

  const updateFood = (id: string, changes: Partial<OwnerMenuItem>) => {
    void persist({ ...restaurant, menu: restaurant.menu.map((item) => item.id === id ? { ...item, ...changes } : item) }, 'Food availability updated.');
  };

  const removeFood = (id: string) => {
    Alert.alert('Remove food?', 'This item will be removed from the customer menu.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void persist({ ...restaurant, menu: restaurant.menu.filter((item) => item.id !== id) }, 'Food removed.') },
    ]);
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => goBackOrReplace('/profile')}><Text style={styles.back}>‹ Back</Text></Pressable>
    <Text style={styles.eyebrow}>RESTAURANT OWNER</Text><Text style={styles.title}>Dashboard</Text>
    <Text style={styles.subtitle}>Manage the information and food availability customers see.</Text>

    <View style={styles.section}><Text style={styles.sectionTitle}>Restaurant information</Text>
      <Field label="RESTAURANT NAME" onChangeText={(name) => setRestaurant((current) => ({ ...current, name }))} value={restaurant.name} />
      <Field label="ADDRESS / LOCATION" onChangeText={(address) => setRestaurant((current) => ({ ...current, address }))} value={restaurant.address} />
      <Field autoCapitalize="none" keyboardType="url" label="GOOGLE MAPS LINK (OPTIONAL)" onChangeText={(mapUrl) => setRestaurant((current) => ({ ...current, mapUrl }))} value={restaurant.mapUrl} />
      <View style={styles.row}><Field containerStyle={styles.half} label="OPENS AT" onChangeText={(opensAt) => setRestaurant((current) => ({ ...current, opensAt }))} placeholder="08:00" value={restaurant.opensAt} /><Field containerStyle={styles.half} label="CLOSES AT" onChangeText={(closesAt) => setRestaurant((current) => ({ ...current, closesAt }))} placeholder="22:00" value={restaurant.closesAt} /></View>
      <Field label="FACILITIES (SEPARATE WITH COMMAS)" onChangeText={setFacilities} placeholder="Wi-Fi, parking, playing ground" value={facilities} />
      <PrimaryButton label="Save restaurant information" onPress={saveDetails} />
    </View>

    <View style={styles.section}><Text style={styles.sectionTitle}>Food menu</Text><Text style={styles.helper}>All foods remain visible to customers. Out-of-stock or out-of-hours foods receive an Unavailable badge.</Text>
      {restaurant.menu.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No food uploaded yet</Text><Text style={styles.helper}>Add the first menu item below.</Text></View> : restaurant.menu.map((item) => {
        const available = isMenuItemAvailable(item, restaurant);
        return <View key={item.id} style={styles.foodCard}><View style={styles.foodHeading}><View style={styles.foodCopy}><Text style={styles.foodName}>{item.name}</Text><Text style={styles.ingredients}>{item.ingredients}</Text></View><Text style={styles.price}>TSh {item.price.toLocaleString()}</Text></View><Text style={styles.servingTime}>Served {item.availableFrom}–{item.availableUntil}</Text><View style={styles.availabilityRow}><View><Text style={[styles.status, !available && styles.unavailable]}>{available ? 'AVAILABLE NOW' : 'UNAVAILABLE'}</Text><Text style={styles.stockLabel}>In stock</Text></View><Switch onValueChange={(inStock) => updateFood(item.id, { inStock })} thumbColor="#FFF" trackColor={{ false: '#B8B1AA', true: ORANGE }} value={item.inStock} /></View><Pressable onPress={() => removeFood(item.id)}><Text style={styles.remove}>Remove food</Text></Pressable></View>;
      })}
    </View>

    <View style={styles.section}><Text style={styles.sectionTitle}>Add food</Text>
      <Field label="FOOD NAME" onChangeText={setFoodName} placeholder="Chicken biryani" value={foodName} />
      <Field label="INGREDIENTS" multiline onChangeText={setIngredients} placeholder="Rice, chicken, spices..." value={ingredients} />
      <Field keyboardType="numeric" label="PRICE (TSH)" onChangeText={setPrice} placeholder="25000" value={price} />
      <View style={styles.row}><Field containerStyle={styles.half} label="SERVED FROM" onChangeText={setAvailableFrom} placeholder="08:00" value={availableFrom} /><Field containerStyle={styles.half} label="SERVED UNTIL" onChangeText={setAvailableUntil} placeholder="22:00" value={availableUntil} /></View>
      <PrimaryButton label="Add food to menu" onPress={addFood} />
    </View>
  </ScrollView></SafeAreaView>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string; containerStyle?: object };
function Field({ label, containerStyle, multiline, ...props }: FieldProps) {
  return <View style={containerStyle}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#968B82" style={[styles.input, multiline && styles.multiline]} /></View>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, paddingBottom: 70 }, back: { color: ORANGE, fontSize: 14, fontWeight: '800', marginBottom: 22 }, eyebrow: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#271812', fontSize: 36, fontWeight: '900', marginTop: 5 }, subtitle: { color: '#71675F', fontSize: 14, lineHeight: 21, marginTop: 6 }, section: { marginTop: 22, padding: 17, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 22, backgroundColor: '#FFFDF9' }, sectionTitle: { color: '#271812', fontSize: 20, fontWeight: '900' }, helper: { color: '#71675F', fontSize: 12, lineHeight: 18, marginTop: 5 }, label: { color: '#71675F', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 15, marginBottom: 6 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 13, paddingHorizontal: 13, color: '#271812', backgroundColor: '#FFF' }, multiline: { minHeight: 82, paddingTop: 13, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: ORANGE, marginTop: 18 }, buttonText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, empty: { alignItems: 'center', padding: 22, marginTop: 14, borderRadius: 15, backgroundColor: CREAM }, emptyTitle: { color: '#271812', fontSize: 15, fontWeight: '900' }, foodCard: { marginTop: 13, padding: 14, borderWidth: 1, borderColor: '#EADFD3', borderRadius: 16, backgroundColor: '#FFF' }, foodHeading: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' }, foodCopy: { flex: 1 }, foodName: { color: '#271812', fontSize: 15, fontWeight: '900' }, ingredients: { color: '#71675F', fontSize: 11, lineHeight: 16, marginTop: 3 }, price: { color: ORANGE, fontSize: 12, fontWeight: '900' }, servingTime: { color: '#71675F', fontSize: 10, marginTop: 9 }, availabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, status: { alignSelf: 'flex-start', color: '#28734D', backgroundColor: '#E8F5ED', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '900' }, unavailable: { color: '#8E2F1A', backgroundColor: '#F5D8D1' }, stockLabel: { color: '#71675F', fontSize: 9, marginTop: 5 }, remove: { color: '#9B321C', fontSize: 11, fontWeight: '800', marginTop: 13 },
});
